<?php

namespace App\Controller;

use App\Entity\Track;
use App\Entity\User;
use App\Repository\TrackRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin')]
#[IsGranted('ROLE_ADMIN')]
class AdminController extends AbstractController
{
    #[Route('/', name: 'admin_dashboard')]
    public function index(UserRepository $userRepository, TrackRepository $trackRepository): Response
    {
        $totalUsers = $userRepository->count([]);
        $totalTracks = $trackRepository->count([]);
        $totalArtists = $userRepository->countArtists(); // Need to implement this or use custom query

        return $this->render('admin/dashboard.html.twig', [
            'totalUsers' => $totalUsers,
            'totalTracks' => $totalTracks,
            'recentUsers' => $userRepository->findBy([], ['createdAt' => 'DESC'], 5),
            'recentTracks' => $trackRepository->findBy([], ['releaseDate' => 'DESC'], 5),
        ]);
    }

    #[Route('/users', name: 'admin_users')]
    public function users(UserRepository $userRepository): Response
    {
        return $this->render('admin/users.html.twig', [
            'users' => $userRepository->findBy([], ['createdAt' => 'DESC']),
        ]);
    }

    #[Route('/user/{id}/delete', name: 'admin_user_delete', methods: ['POST'])]
    public function deleteUser(User $user, EntityManagerInterface $entityManager): Response
    {
        // Prevent deleting yourself
        if ($user === $this->getUser()) {
            $this->addFlash('error', 'You cannot delete your own account.');
            return $this->redirectToRoute('admin_users');
        }

        $entityManager->remove($user);
        $entityManager->flush();

        $this->addFlash('success', 'User deleted successfully.');
        return $this->redirectToRoute('admin_users');
    }

    #[Route('/user/{id}/role', name: 'admin_user_role', methods: ['POST'])]
    public function changeUserRole(User $user, \Symfony\Component\HttpFoundation\Request $request, EntityManagerInterface $entityManager): Response
    {
        // Prevent modifying yourself
        if ($user === $this->getUser()) {
            $this->addFlash('error', 'You cannot change your own role.');
            return $this->redirectToRoute('admin_users');
        }

        $role = $request->request->get('role');
        $validRoles = ['ROLE_USER', 'ROLE_ARTIST', 'ROLE_ADMIN'];

        if (in_array($role, $validRoles)) {
            $user->setRoles([$role]);
            $entityManager->flush();
            $this->addFlash('success', 'User role updated successfully.');
        } else {
            $this->addFlash('error', 'Invalid role selected.');
        }

        return $this->redirectToRoute('admin_users');
    }

    #[Route('/tracks', name: 'admin_tracks')]
    public function tracks(TrackRepository $trackRepository): Response
    {
        return $this->render('admin/tracks.html.twig', [
            'tracks' => $trackRepository->findBy([], ['releaseDate' => 'DESC']),
        ]);
    }

    #[Route('/track/{id}/delete', name: 'admin_track_delete', methods: ['POST'])]
    public function deleteTrack(Track $track, EntityManagerInterface $entityManager): Response
    {
        $entityManager->remove($track);
        $entityManager->flush();

        $this->addFlash('success', 'Track deleted successfully.');
        return $this->redirectToRoute('admin_tracks');
    }
    
    #[Route('/track/{id}/toggle-public', name: 'admin_track_toggle', methods: ['POST'])]
    public function toggleTrackPublic(Track $track, EntityManagerInterface $entityManager): Response
    {
        $track->setPublic(!$track->isPublic());
        $entityManager->flush();
        
        $this->addFlash('success', 'Track visibility updated.');
        return $this->redirectToRoute('admin_tracks');
    }
}
