export const experiments = [
  {
    title: 'Meridian & Ninth',
    subtitle: 'Block study',
    page: 'cities/block-study/index.html',
    preview: 'cities/block-study/preview.webp',
    previewAlt: 'Oblique view down Meridian Avenue. A row of shops and a corner building overlook the crossing.',
    previewYear: 1965,
    years: [1945, 1965, 1985, 2005, 2025, 2055],
    description: 'Return to the same intersection over 110 years, from brick shopfronts and tailfin cars to planted towers and electric shuttles.',
    requestedModels: ['GPT Astra 5.2', 'GPT Sol 5.2'],
    prompt: `Create a 3D scene of a city block. Emphasis on detail is very important.

The scene must have a timeline slider in the top, with the following options:
1945, 1965, 1985, 2005, 2025 and 2055

The point of the scene is to be able to select any of the 5 different years, and the scene will transform in front of your eyes to the time period selected from the slider.

Time period should affect all aspects of the city block. The buildings, the vehicles, the storefronts, advertisements, outfits of the pedestrians, everything.

This must be a polished high end scene with SFX, ability to navigate around and look at things, etc. Go all out.`,
  },
];
