/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			'hud-accent': 'hsl(var(--hud-accent))',
  			'hud-accent-soft': 'hsl(var(--hud-accent-soft))',
  			'hud-accent-glow': 'hsl(var(--hud-accent-glow))',
  			'panel-bg': 'hsl(var(--panel-bg))',
  			'panel-bg-darker': 'hsl(var(--panel-bg-darker))',
  			'panel-stroke': 'hsl(var(--panel-stroke))',
  			'bg-deep': 'hsl(var(--bg-deep))',
  			'text-primary': 'hsl(var(--text-primary))',
  			'text-subtle': 'hsl(var(--text-subtle))',
  			'text-accent': 'hsl(var(--text-accent))',
  			'allied-accent': 'hsl(var(--allied-accent))',
  			'hostile-accent': 'hsl(var(--hostile-accent))'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

