<?php

namespace App\Controller;

use App\Entity\Category;
use App\Entity\Playlist;
use App\Entity\Track;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class PlaylistController extends AbstractController
{
    #[Route('/playlists', name: 'app_playlist_index')]
    public function index(EntityManagerInterface $em): Response
    {
        $categories = $em->getRepository(Category::class)->findAll();
        return $this->render('playlist/index.html.twig', [
            'playlists'  => $this->getUser()->getPlaylists(),
            'categories' => $categories,
        ]);
    }

    #[Route('/api/playlist/suggestions', name: 'api_playlist_suggestions', methods: ['GET'])]
    public function suggestions(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $genre = $request->query->get('genre', '');
        $qb = $em->getRepository(Track::class)->createQueryBuilder('t')
            ->orderBy('t.playCount', 'DESC')
            ->setMaxResults(6);

        if ($genre) {
            $qb->join('t.category', 'c')
               ->where('LOWER(c.name) LIKE LOWER(:genre)')
               ->setParameter('genre', '%' . $genre . '%');
        }

        $tracks = $qb->getQuery()->getResult();
        $data = array_map(fn(Track $t) => [
            'id'     => $t->getId(),
            'title'  => $t->getTitle(),
            'artist' => $t->getArtist()?->getArtistName() ?? $t->getArtist()?->getEmail(),
            'cover'  => $t->getCoverImage(),
            'plays'  => $t->getPlayCount(),
        ], $tracks);

        return $this->json($data);
    }

    #[Route('/playlist/create', name: 'app_playlist_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $entityManager): Response
    {
        $name = $request->request->get('name');
        if (!$name) {
             $this->addFlash('error', 'Playlist name cannot be empty.');
             return $this->redirectToRoute('app_discover');
        }

        $playlist = new Playlist();
        $playlist->setName($name);
        $playlist->setUser($this->getUser());

        // Add suggested tracks if any were selected in the smart modal
        $suggestedIds = array_filter(explode(',', $request->request->get('suggested_tracks', '')));
        foreach ($suggestedIds as $trackId) {
            $track = $entityManager->getRepository(Track::class)->find((int)$trackId);
            if ($track) {
                $playlist->addTrack($track);
            }
        }

        $entityManager->persist($playlist);
        $entityManager->flush();

        $count = count($suggestedIds);
        $msg = $count > 0
            ? "Playlist created with {$count} suggested track" . ($count > 1 ? 's' : '') . '!'
            : 'Playlist created!';
        $this->addFlash('success', $msg);
        return $this->redirectToRoute('app_playlist_show', ['id' => $playlist->getId()]);
    }


    #[Route('/playlist/{id}', name: 'app_playlist_show')]
    public function show(Playlist $playlist): Response
    {
        if ($playlist->getUser() !== $this->getUser()) {
             throw $this->createAccessDeniedException();
        }

        return $this->render('playlist/show.html.twig', [
            'playlist' => $playlist
        ]);
    }

    #[Route('/api/playlist/{id}/add-track/{trackId}', name: 'api_playlist_add_track', methods: ['POST'])]
    public function addTrack(Playlist $playlist, string $trackId, EntityManagerInterface $entityManager): Response
    {
        if ($playlist->getUser() !== $this->getUser()) {
             return $this->json(['error' => 'Unauthorized'], 403);
        }

        $track = $entityManager->getRepository(Track::class)->find($trackId);
        if (!$track) {
             return $this->json(['error' => 'Track not found'], 404);
        }

        $playlist->addTrack($track);
        $entityManager->flush();

        return $this->json(['success' => true]);
    }
    
    #[Route('/api/playlist/{id}/remove-track/{trackId}', name: 'api_playlist_remove_track', methods: ['DELETE'])]
    public function removeTrack(Playlist $playlist, string $trackId, EntityManagerInterface $entityManager): Response
    {
        if ($playlist->getUser() !== $this->getUser()) {
             return $this->json(['error' => 'Unauthorized'], 403);
        }

        $track = $entityManager->getRepository(Track::class)->find($trackId);
        if (!$track) {
             return $this->json(['error' => 'Track not found'], 404);
        }

        $playlist->removeTrack($track);
        $entityManager->flush();

        return $this->json(['success' => true]);
    }
}
