// i18next-scanner config
// Run: npm run i18n:scan
// Scans all TSX/TS/JSX files for t('key') calls and reports keys
// missing from any language file. Catches translation gaps before deploy.

module.exports = {
  input: ['src/**/*.{ts,tsx}'],
  output: './',
  options: {
    debug: false,
    sort: true,
    func: {
      list: ['t', 'i18n.t'],
      extensions: ['.ts', '.tsx'],
    },
    lngs: ['en', 'es', 'zh', 'hi', 'ar', 'bn', 'pt', 'ru', 'fr', 'ur', 'yi', 'nah'],
    defaultLng: 'en',
    defaultNs: 'translation',
    resource: {
      loadPath: 'src/i18n/locales/{{lng}}.json',
      savePath: 'src/i18n/locales/{{lng}}.json',
    },
    interpolation: {
      prefix: '{{',
      suffix: '}}',
    },
  },
}
