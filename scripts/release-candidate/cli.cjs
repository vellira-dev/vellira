const {
  recovery: { createPackageInfo, publicPackages },
} = require('../semantic-release-packages.cjs');
const { prepareReleaseCandidate } = require('./package-artifacts.cjs');

const packageInfos = publicPackages.map(createPackageInfo);
prepareReleaseCandidate(packageInfos, {
  expectedSourceSha:
    process.env.VELLIRA_CANDIDATE_SHA ?? process.env.GITHUB_SHA,
});
