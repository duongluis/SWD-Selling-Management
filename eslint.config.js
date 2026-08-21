// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // eslint-config-expo tắt no-undef (nó giả định TypeScript lo phần này), nhưng dự án
    // chủ yếu là .js/.jsx nên biến chưa khai báo lọt thẳng ra runtime rồi bị nuốt vào
    // các khối catch — đã dính 2 lần: `role` trong commissionCalc và `setDoc` thiếu import
    // ở màn Hoa hồng. Bật lại cho file JS.
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      'no-undef': 'error',
    },
  },
]);
