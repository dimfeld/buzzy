function readPackage(pkg) {
  if (pkg.name === 'partysocket' && pkg.dependencies) {
    delete pkg.dependencies['react'];
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
