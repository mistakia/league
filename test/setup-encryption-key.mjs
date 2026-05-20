// Test fixture: in-repo encryption key for decrypting committed test
// fixtures. This value is in git only because it decrypts in-repo test
// fixtures; it is not a production secret. Loaded via mocha --require so
// test scripts no longer need to inline the key in their command strings.
process.env.CONFIG_ENCRYPTION_KEY =
  'cc0e93bb948088a5a35affafb6e4b47210a659f9e150f9a55a41222eaacf5520'
