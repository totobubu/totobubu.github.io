import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

export const MyPreset = definePreset(Lara, {
    semantic: {
        primary: {
            50: '#fff9eb',
            100: '#ffeec5',
            200: '#ffe09e',
            300: '#ffd177',
            400: '#f6bf54',
            500: '#d4af37', // gold base
            600: '#b8942c',
            700: '#9d7b23',
            800: '#80621a',
            900: '#634913',
            950: '#452f0c',
        },
        colorScheme: {
            light: {
                primary: {
                    color: '#d4af37',
                    inverseColor: '#1f2937',
                    hoverColor: '#e6c75f',
                    activeColor: '#b8942c',
                },
                highlight: {
                    background: 'rgba(212, 175, 55, 0.12)',
                    focusBackground: 'rgba(212, 175, 55, 0.18)',
                    color: '#1f2937',
                    focusColor: '#111827',
                },
                formField: {
                    hoverBorderColor: '{primary.hoverColor}',
                },
            },
            dark: {
                primary: {
                    color: '#f6e7b4',
                    inverseColor: '#111827',
                    hoverColor: '#f1d77c',
                    activeColor: '#d4af37',
                },
                highlight: {
                    background: 'rgba(246, 231, 180, 0.16)',
                    focusBackground: 'rgba(246, 231, 180, 0.24)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)',
                },
                formField: {
                    hoverBorderColor: '{primary.color}',
                },
            },
        },
        focusRing: {
            width: '2px',
            style: 'dashed',
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
                    },
                    subtitle: {
                        color: '{surface.500}',
                    },
                },
                dark: {
                    root: {
                        background: '{surface.900}',
                        color: '{surface.0}',
                    },
                    subtitle: {
                        color: '{surface.400}',
                    },
                },
            },
        },
    },
});
