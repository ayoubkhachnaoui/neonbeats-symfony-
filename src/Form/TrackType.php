<?php

namespace App\Form;

use App\Entity\Category;
use App\Entity\Track;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\Extension\Core\Type\HiddenType;
use Symfony\Component\Form\Extension\Core\Type\NumberType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\File;
use Symfony\Component\Validator\Constraints\NotBlank;

class TrackType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('title', TextType::class, [
                'constraints' => [new NotBlank(message: 'Please enter a title')],
            ])
            ->add('genre', TextType::class, [
                'mapped' => false,
                'required' => true,
                'label' => 'Genre',
                'attr' => [
                    'placeholder' => 'Select or Create Genre...',
                    'list' => 'genre-list',
                    'class' => 'w-full bg-[#111] border border-[#555] text-white px-2 py-1 text-sm focus:border-cyan-500 focus:ring-0 outline-none rounded-none' // Match the Ableton style
                ]
            ])
            ->add('bpm', HiddenType::class, [
                'required' => false,
                'attr' => ['id' => 'track_bpm'], // Add ID for JS targeting
            ])
            ->add('duration', HiddenType::class, [
                'attr' => ['id' => 'track_duration'], // Add ID for JS targeting
            ])
            ->add('audioFile', FileType::class, [
                'label' => 'Audio File (MP3/WAV)',
                'mapped' => false,
                'required' => true,
                'constraints' => [
                    new File(
                        maxSize: '1024M',
                        mimeTypes: [
                            'audio/mpeg',
                            'audio/wav',
                            'audio/x-wav',
                        ],
                        mimeTypesMessage: 'Please upload a valid MP3 or WAV audio file',
                    )
                ],
            ])
            ->add('coverImage', FileType::class, [
                'label' => 'Cover Art',
                'mapped' => false,
                'required' => false,
                'constraints' => [
                    new File(
                        maxSize: '20M',
                        mimeTypes: [
                            'image/jpeg',
                            'image/png',
                            'image/webp',
                        ],
                        mimeTypesMessage: 'Please upload a valid image (JPEG, PNG, WEBP)',
                    )
                ],
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Track::class,
        ]);
    }
}
