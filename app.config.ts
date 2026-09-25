/**
 * Nuxt UI, stripped back to the house style.
 *
 * Every component here is used for what it does, not how it looks: focus
 * management, keyboard handling, ARIA wiring, real `role` attributes. The
 * overrides below replace the library's variant classes outright rather than
 * layering on top of them — a `base` class loses to a variant class, which is
 * how the first pass ended up with lime pills on a site that has no pills.
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'lime',
      neutral: 'stone',
    },

    button: {
      slots: {
        base: [
          'font-mono cursor-pointer inline-flex items-center',
          'transition-colors disabled:opacity-50',
          'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-pn-accent',
        ].join(' '),
      },
      variants: {
        // The house button is a bracketed mono label. No fill, no ring, no padding.
        variant: {
          ghost: {
            base: 'bg-transparent text-pn-muted hover:bg-transparent hover:text-pn-fg-bright',
          },
        },
        size: {
          xs: { base: 'p-0 text-xs gap-1' },
        },
      },
      defaultVariants: {
        variant: 'ghost',
        size: 'xs',
        color: 'neutral',
      },
    },

    badge: {
      slots: {
        base: 'font-mono inline-flex items-center whitespace-nowrap',
      },
      variants: {
        variant: {
          soft: {
            base: 'bg-transparent ring-0 text-inherit',
          },
        },
        size: {
          sm: { base: 'p-0 text-xs gap-1.5' },
        },
      },
      defaultVariants: {
        variant: 'soft',
        size: 'sm',
        color: 'neutral',
      },
    },

    separator: {
      slots: {
        border: 'border-pn-rule/70',
        container: 'font-mono',
        label: 'font-mono text-xs tracking-widest text-pn-muted lowercase',
      },
      defaultVariants: {
        type: 'dashed',
        color: 'neutral',
      },
    },
  },
})
