<?php

namespace App\DataFixtures;

use App\Entity\Category;
use App\Entity\Track;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AppFixtures extends Fixture
{
    public function __construct(
        private UserPasswordHasherInterface $hasher
    ) {}

    public function load(ObjectManager $manager): void
    {
        // 1. Create Categories
        $categories = [];
        $genres = [
            ['Synthwave', 'synthwave', '#ff00ff'],
            ['Cyberpunk', 'cyberpunk', '#00ffff'],
            ['Retrowave', 'retrowave', '#ff9900'],
            ['Dark Techno', 'dark-techno', '#6600cc'],
            ['Ambient', 'ambient', '#00cc99'],
        ];

        foreach ($genres as [$name, $slug, $color]) {
            $category = new Category();
            $category->setName($name);
            $category->setSlug($slug);
            $category->setHexColor($color);
            $manager->persist($category);
            $categories[] = $category;
        }

        // 2. Create Artists
        $artists = [];
        for ($i = 1; $i <= 5; $i++) {
            $artist = new User();
            $artist->setEmail("artist{$i}@neonbeats.com");
            $artist->setRoles(['ROLE_ARTIST']);
            $artist->setPassword($this->hasher->hashPassword($artist, 'password'));
            $artist->setVerified(true);
            $artist->setArtistName("Neon Artist {$i}");
            $artist->setBio("Creating the sounds of the future.");
            $manager->persist($artist);
            $artists[] = $artist;
        }

        // 3. Create Tracks
        $trackTitles = [
            'Night City Drive', 'Cyber Soul', 'Neon Rain', 'Digital Dreams', 
            'Matrix Glitch', 'Future Funk', 'Retro Horizon', 'Synth Spirit'
        ];

        foreach ($trackTitles as $title) {
            $track = new Track();
            $track->setTitle($title);
            $track->setArtist($artists[array_rand($artists)]);
            $track->setCategory($categories[array_rand($categories)]);
            $track->setAudioFilename('dummy.mp3'); // Placeholder
            $track->setDuration(rand(180, 300));
            $track->setBpm(rand(80, 140));
            $track->setReleaseDate(new \DateTime());
            $track->setPlayCount(rand(0, 1000));
            $track->setPublic(true);
            
            // Optionally set cover image if files existed
            // $track->setCoverImage('cover.jpg');

            $manager->persist($track);
        }

        $manager->flush();
    }
}
