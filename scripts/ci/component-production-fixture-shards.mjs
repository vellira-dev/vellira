// One explicit expensive shard and its complement: new fixture names cannot
// silently fall between two independently maintained allowlists.
export const unitProductionFixturePattern = 'boolean-form-control|compound-divergent';
export const remainingProductionFixturePattern =
  `^(?![\\s\\S]*(?:${unitProductionFixturePattern}))[\\s\\S]*$`;
