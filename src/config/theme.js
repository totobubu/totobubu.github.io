import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

export const MyPreset = definePreset(Lara, {
    semantic: {
        typography: {
            fontFamily: "'Nanum Gothic Coding', monospace",
        },
        primary: {
            50: '#eaf3ec',
            100: '#c5edc7',
            200: '#91b795',
            300: '#75fbb8',
            400: '#58e073',
            500: '#00A843', // Primary Green from text description
            600: '#006e29', // YAML primary
            700: '#006c45',
            800: '#00531d',
            900: '#004c1a',
            950: '#002107',
        },
        surface: {
            0: '#ffffff',
            50: '#f6fff8',  // Base background from text
            100: '#f3fcf5', // surface
            200: '#e7f0e9', // surface-container
            300: '#dce5de', // surface-variant
            400: '#bbcbb8', // outline-variant
            500: '#6c7b6a', // outline
            600: '#446649', // tertiary
            700: '#3c4a3c', // on-surface-variant
            800: '#2a322e', // inverse-surface
            900: '#151d19', // on-surface
            950: '#0e1411',
        },
        colorScheme: {
            light: {
                primary: {
                    color: '{primary.500}',
                    inverseColor: '#ffffff',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.600}',
                    activeColor: '{primary.700}',
                },
                surface: {
                    0: '{surface.0}',
                    50: '{surface.50}',
                    100: '{surface.100}',
                    200: '{surface.200}',
                    300: '{surface.300}',
                    400: '{surface.400}',
                    500: '{surface.500}',
                    600: '{surface.600}',
                    700: '{surface.700}',
                    800: '{surface.800}',
                    900: '{surface.900}',
                    950: '{surface.950}'
                },
                highlight: {
                    background: '{primary.50}',
                    focusBackground: '{primary.100}',
                    color: '{primary.900}',
                    focusColor: '{primary.950}',
                },
                formField: {
                    hoverBorderColor: '{primary.500}',
                },
            },
            dark: {
                primary: {
                    color: '{primary.400}', // Inverse primary (#58e073)
                    inverseColor: '#002107',
                    contrastColor: '#002107',
                    hoverColor: '{primary.300}',
                    activeColor: '{primary.200}',
                },
                surface: {
                    0: '{surface.950}',
                    50: '{surface.900}',
                    100: '{surface.800}',
                    200: '{surface.700}',
                    300: '{surface.600}',
                    400: '{surface.500}',
                    500: '{surface.400}',
                    600: '{surface.300}',
                    700: '{surface.200}',
                    800: '{surface.100}',
                    900: '{surface.50}',
                    950: '{surface.0}'
                },
                highlight: {
                    background: '{surface.800}',
                    focusBackground: '{surface.700}',
                    color: '{primary.400}',
                    focusColor: '{primary.400}',
                },
                formField: {
                    hoverBorderColor: '{primary.400}',
                },
            },
        },
        focusRing: {
            width: '2px',
            style: 'solid',
            color: '{primary.color}',
            offset: '1px',
        },
    },
    components: {
        card: {
            colorScheme: {
                light: {
                    root: {
                        background: '{surface.0}',
                        color: '{surface.900}',
                        borderColor: '{primary.600}',
                    },
                    subtitle: {
                        color: '{surface.500}',
                    },
                },
                dark: {
                    root: {
                        background: '{surface.800}', // inverse-surface
                        color: '{surface.100}',
                        borderColor: '{primary.400}',
                    },
                    subtitle: {
                        color: '{surface.400}',
                    },
                },
            },
        },
        button: {
            colorScheme: {
                light: {
                    root: {
                        borderRadius: '8px'
                    }
                },
                dark: {
                    root: {
                        borderRadius: '8px'
                    }
                }
            }
        }
    },
});
