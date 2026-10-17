const IMAGES: Provider[] = [
    {
        optgroup: 'Random photos',
        options: [
            {
                name: 'Random photos',
                value: 'picsum-images-daylight',
            },
        ],
    },
    // {
    // 	optgroup: 'Pixabay',
    // 	options: [
    // 		{
    // 			name: 'Pixabay Search',
    // 			value: 'pixabay-images-search',
    // 		},
    // 	],
    // },
    // {
    // 	optgroup: 'MET Museum',
    // 	options: [
    // 		{
    // 			name: 'MET Museum paintings',
    // 			value: 'metmuseum-images-paintings',
    // 		},
    // 	],
    // },
]

const VIDEOS: Provider[] = []

//

interface Provider {
    optgroup: string
    options: {
        name: string
        value: string
    }[]
}

export const PROVIDERS = { IMAGES, VIDEOS }
