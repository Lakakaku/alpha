module.exports = {
  ...require('../../.prettierrc.js'),
  overrides: [
    {
      files: '*.ts',
      options: {
        parser: 'typescript'
      }
    }
  ]
};