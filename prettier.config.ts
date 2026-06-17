import { type Config } from 'prettier'

const config: Config = {
  singleQuote: true,
  jsxSingleQuote: false,
  semi: false,
  tabWidth: 2,
  trailingComma: 'none',
  printWidth: 80,
  plugins: ['prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.tsx',
      options: { printWidth: 100 }
    }
  ]
}

export default config
