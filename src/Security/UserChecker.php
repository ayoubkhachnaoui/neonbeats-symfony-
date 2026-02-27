<?php

namespace App\Security;

use App\Entity\User as AppUser;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

class UserChecker implements UserCheckerInterface
{
    public function __construct(
        #[Autowire(param: 'kernel.environment')]
        private string $env = 'dev'
    ) {}
    public function checkPreAuth(UserInterface $user): void
    {
        // Skip email verification in dev so developers can log in without clicking email links
        if ($this->env === 'dev') {
            return;
        }

        if (!$user instanceof AppUser) {
            return;
        }

        if (!$user->isVerified()) {
            throw new CustomUserMessageAccountStatusException('Please verify your email address before logging in.');
        }
    }

    public function checkPostAuth(UserInterface $user, ?TokenInterface $token = null): void
    {
        if (!$user instanceof AppUser) {
            return;
        }

        // Additional checks after login if needed (e.g. banned status)
    }
}
