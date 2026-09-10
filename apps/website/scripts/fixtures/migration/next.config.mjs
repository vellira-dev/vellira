export default {
  generateBuildId: async () => process.env.VELLIRA_BUILD_ID,
  experimental: { staleTimes: { static: 5, dynamic: 0 } },
};
