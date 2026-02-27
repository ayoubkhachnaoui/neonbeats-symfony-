<?php

namespace App\Controller;

use App\Repository\TrackRepository;
use App\Entity\Track;
use App\Form\TrackType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\String\Slugger\SluggerInterface;

class TrackController extends AbstractController
{
    #[Route('/discover', name: 'app_discover')]
    public function discover(Request $request, TrackRepository $trackRepository, EntityManagerInterface $entityManager): Response
    {
        if (!$this->getUser()) {
            return $this->redirectToRoute('app_login');
        }

        $search = $request->query->get('q');
        $genre = $request->query->get('genre');
        
        // 1. All Tracks (Unified List)
        $qb = $trackRepository->createQueryBuilder('t')
            ->select('DISTINCT t')
            ->leftJoin('t.category', 'c')
            ->addSelect('c')
            ->leftJoin('t.artist', 'a')
            ->addSelect('a');

        if ($search) {
             $qb->andWhere('t.title LIKE :search OR a.artistName LIKE :search')
                ->setParameter('search', '%'.$search.'%');
        }
        
        if ($genre) {
             $qb->andWhere('c.name = :genre')
                ->setParameter('genre', $genre);
        }

        // Default sort by play count (Trending) if no specific sort requested
        // Frontend JS handles client-side sorting, but good to have a default
        $allTracks = $qb->orderBy('t.playCount', 'DESC')->getQuery()->getResult();
        
        // 2. User Favorites
        $favorites = [];
        $favoriteIds = [];
        if ($this->getUser()) {
             $favorites = $this->getUser()->getFavoriteTracks();
             foreach ($favorites as $f) {
                 $favoriteIds[] = $f->getId()->toRfc4122();
             }
        }

        // 3. Genres for filter
        $categories = $entityManager->getRepository(\App\Entity\Category::class)->findAll();

        return $this->render('track/discover.html.twig', [
            'allTracks' => $allTracks,
            'favorites' => $favorites, // Still needed for other potential logic
            'favoriteIds' => $favoriteIds,
            'categories' => $categories,
            'searchQuery' => $search
        ]);
    }

    #[Route('/track/new', name: 'app_track_new')]
    public function new(Request $request, EntityManagerInterface $entityManager, SluggerInterface $slugger): Response
    {
        $this->denyAccessUnlessGranted('ROLE_ARTIST');

        $track = new Track();
        $track->setArtist($this->getUser());
        $form = $this->createForm(TrackType::class, $track);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            // DUPLICATE CHECK
            $existingTrack = $entityManager->getRepository(Track::class)->findOneBy([
                'artist' => $this->getUser(),
                'title' => $track->getTitle()
            ]);

            if ($existingTrack) {
                $this->addFlash('error', 'You have already uploaded a track with this title.');
                
                $categories = $entityManager->getRepository(\App\Entity\Category::class)->findAll();
                
                // Fetch User's Tracks for Dashboard
                $myTracks = $entityManager->getRepository(Track::class)->findBy(
                    ['artist' => $this->getUser()], 
                    ['releaseDate' => 'DESC']
                );
                
                return $this->render('track/new.html.twig', [
                    'form' => $form->createView(),
                    'categories' => $categories,
                    'myTracks' => $myTracks
                ], new Response(null, 422));
            }

            // Handle Genre (Find existing or Create new)
            $genreName = $form->get('genre')->getData();
            if ($genreName) {
                $categoryRepository = $entityManager->getRepository(\App\Entity\Category::class);
                $category = $categoryRepository->findOneBy(['name' => $genreName]);

                if (!$category) {
                    $category = new \App\Entity\Category();
                    $category->setName($genreName);
                    $category->setSlug($slugger->slug($genreName));
                    
                    // Random Neon Color
                    $neonColors = ['#00FFFF', '#FF00FF', '#39FF14', '#FF69B4', '#9400D3'];
                    $category->setHexColor($neonColors[array_rand($neonColors)]);
                    
                    $entityManager->persist($category);
                }
                
                $track->setCategory($category);
            }

            /** @var UploadedFile $audioFile */
            $audioFile = $form->get('audioFile')->getData();
            if ($audioFile) {
                $originalFilename = pathinfo($audioFile->getClientOriginalName(), PATHINFO_FILENAME);
                $safeFilename = $slugger->slug($originalFilename);
                $newFilename = $safeFilename.'-'.uniqid().'.'.$audioFile->guessExtension();

                try {
                    $audioFile->move(
                        $this->getParameter('kernel.project_dir').'/public/uploads/audio',
                        $newFilename
                    );
                } catch (FileException $e) {
                    // ... handle exception if something happens during file upload
                }
                $track->setAudioFilename($newFilename);

                // Calculate Duration
                $audioPath = $this->getParameter('kernel.project_dir').'/public/uploads/audio/'.$newFilename;
                try {
                    $getID3 = new \getID3();
                    $fileInfo = $getID3->analyze($audioPath);
                    if (isset($fileInfo['playtime_seconds'])) {
                        $track->setDuration((int) round($fileInfo['playtime_seconds']));
                    }
                } catch (\Exception $e) {
                    // Ignore duration error, default is 0
                }
            }

            /** @var UploadedFile $coverFile */
            $coverFile = $form->get('coverImage')->getData();
            if ($coverFile) {
                $originalFilename = pathinfo($coverFile->getClientOriginalName(), PATHINFO_FILENAME);
                $safeFilename = $slugger->slug($originalFilename);
                $newFilename = $safeFilename.'-'.uniqid().'.'.$coverFile->guessExtension();

                try {
                    $coverFile->move(
                        $this->getParameter('kernel.project_dir').'/public/uploads/images',
                        $newFilename
                    );
                } catch (FileException $e) {
                    // ... handle exception
                }
                $track->setCoverImage($newFilename);
            }

            // Set defaults
            $track->setReleaseDate(new \DateTime());
            
            $entityManager->persist($track);
            $entityManager->flush();

            $this->addFlash('success', 'Track uploaded successfully!');
            return $this->redirectToRoute('app_track_new'); // Redirect to same page to see new track in dashboard
        }

        // Fetch categories for Datalist
        $categories = $entityManager->getRepository(\App\Entity\Category::class)->findAll();
        
        // Fetch User's Tracks for Dashboard
        $myTracks = $entityManager->getRepository(Track::class)->findBy(
            ['artist' => $this->getUser()], 
            ['releaseDate' => 'DESC']
        );
        
        $response = new Response(null, $form->isSubmitted() && !$form->isValid() ? 422 : 200);

        return $this->render('track/new.html.twig', [
            'form' => $form->createView(),
            'categories' => $categories,
            'myTracks' => $myTracks
        ], $response);
    }

    #[Route('/track/{id}/delete', name: 'app_track_delete', methods: ['POST'])]
    public function delete(Request $request, Track $track, EntityManagerInterface $entityManager): Response
    {
        if ($track->getArtist() !== $this->getUser()) {
             throw $this->createAccessDeniedException('You do not own this track.');
        }

        if ($this->isCsrfTokenValid('delete'.$track->getId(), $request->request->get('_token'))) {
            // Optional: Delete files logic here if needed
            
            $entityManager->remove($track);
            $entityManager->flush();
            $this->addFlash('success', 'Track deleted.');
        }

        return $this->redirectToRoute('app_track_new');
    }

    #[Route('/track/{id}', name: 'app_track_play')]
    public function play(Track $track, TrackRepository $trackRepository): Response
    {
        // Get Next/Prev Track in same Genre (Strict Navigation)
        $category = $track->getCategory();
        $nextTrack = null;
        $prevTrack = null;
        
        if ($category) {
            // Find next track with same category and ID > current
             $nextTrack = $trackRepository->createQueryBuilder('t')
                ->where('t.category = :category')
                ->andWhere('t.id > :currentId')
                ->setParameter('category', $category)
                ->setParameter('currentId', $track->getId()) // Note: UUID comparison might vary, simpler to fetch all and find index for persistent order
                ->orderBy('t.id', 'ASC')
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();

             // Fallback for circular navigation (first track)
             if (!$nextTrack) {
                  $nextTrack = $trackRepository->createQueryBuilder('t')
                    ->where('t.category = :category')
                    ->setParameter('category', $category)
                    ->orderBy('t.id', 'ASC')
                    ->setMaxResults(1)
                    ->getQuery()
                    ->getOneOrNullResult();
             }

             // Find prev track
             $prevTrack = $trackRepository->createQueryBuilder('t')
                ->where('t.category = :category')
                ->andWhere('t.id < :currentId')
                ->setParameter('category', $category)
                ->setParameter('currentId', $track->getId())
                ->orderBy('t.id', 'DESC')
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();
        }

        // INFINITE SKIP: If no strict next track (or no category), pick a random one
        if (!$nextTrack) {
            // Get a random track that isn't the current one
            $allIds = $trackRepository->createQueryBuilder('t')
                ->select('t.id')
                ->where('t.id != :currentId')
                ->setParameter('currentId', $track->getId())
                ->getQuery()
                ->getSingleColumnResult();
            
            if (!empty($allIds)) {
                $randomId = $allIds[array_rand($allIds)];
                $nextTrack = $trackRepository->find($randomId);
            }
        }

        // Recommendations (Keep for "Up Next" visual list, but controls use strict nav)
        $recommendations = $trackRepository->createQueryBuilder('t')
            ->where('t.category = :category')
            ->andWhere('t.id != :currentId')
            ->setParameter('category', $track->getCategory())
            ->setParameter('currentId', $track->getId())
            ->setMaxResults(4)
            ->getQuery()
            ->getResult();

        return $this->render('track/play.html.twig', [
            'track' => $track,
            'recommendations' => $recommendations,
            'nextTrack' => $nextTrack,
            'prevTrack' => $prevTrack
        ]);
    }

    #[Route('/api/track/{id}/like', name: 'api_track_like', methods: ['POST'])]
    public function like(Track $track, EntityManagerInterface $entityManager): Response
    {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        if ($user->getFavoriteTracks()->contains($track)) {
            $user->removeFavoriteTrack($track);
            $isLiked = false;
        } else {
            $user->addFavoriteTrack($track);
            $isLiked = true;
        }

        $entityManager->flush();

        return $this->json(['liked' => $isLiked]);
    }

    #[Route('/api/track/{id}/play', name: 'api_track_play_count', methods: ['POST'])]
    public function bumpPlayCount(Track $track, EntityManagerInterface $entityManager): Response
    {
        $track->incrementPlayCount();
        $entityManager->flush();

        return $this->json(['plays' => $track->getPlayCount()]);
    }

    #[Route('/favorites', name: 'app_favorites')]
    public function favorites(): Response
    {
        $favorites = [];
        if ($this->getUser()) {
             $favorites = $this->getUser()->getFavoriteTracks();
        }

        return $this->render('track/favorites.html.twig', [
            'favorites' => $favorites
        ]);
    }
    #[Route('/track/{id}/stream', name: 'app_track_stream')]
    public function streamAudio(Track $track, Request $request): Response
    {
        $filename = $track->getAudioFilename();
        $projectDir = $this->getParameter('kernel.project_dir');
        $audioPath = $projectDir . '/public/uploads/audio/' . $filename;
        $audioPath = str_replace('/', DIRECTORY_SEPARATOR, $audioPath);

        if (!file_exists($audioPath)) {
            return new Response("File not found", 404);
        }

        $fileSize = filesize($audioPath);
        $start = 0;
        $end = $fileSize - 1;
        $isRange = false;

        // Handle Range Header
        if ($request->headers->has('Range')) {
            $range = $request->headers->get('Range');
            if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
                $start = intval($matches[1]);
                if (!empty($matches[2])) {
                    $end = intval($matches[2]);
                }
                $isRange = true;
            }
        }
        
        // Sanity checks
        if ($start > $end || $start >= $fileSize) {
            return new Response('Requested Range Not Satisfiable', 416, [
                'Content-Range' => "bytes */$fileSize"
            ]);
        }

        $length = $end - $start + 1;
        
        $response = new \Symfony\Component\HttpFoundation\StreamedResponse(function() use ($audioPath, $start, $length) {
            $fp = fopen($audioPath, 'rb');
            fseek($fp, $start);
            
            $buffer = 8192;
            $remaining = $length;
            
            while (!feof($fp) && $remaining > 0) {
                $read = ($remaining > $buffer) ? $buffer : $remaining;
                echo fread($fp, $read);
                flush();
                $remaining -= $read;
            }
            fclose($fp);
        });

        $response->headers->set('Content-Type', 'audio/mpeg'); // Assuming MP3, should verify extension
        $response->headers->set('Content-Length', $length);
        $response->headers->set('Accept-Ranges', 'bytes');
        
        if ($isRange) {
            $response->setStatusCode(206);
            $response->headers->set('Content-Range', sprintf('bytes %d-%d/%d', $start, $end, $fileSize));
        }

        return $response;
    }
}
