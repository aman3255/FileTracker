const VALID_STATUSES = {
    UPLOADING: "uploading",
    PROCESSING: "processing",
    READY: "ready",
    FAILED: "failed",
  };
  
  const PROGRESS_RANGES = {
    [VALID_STATUSES.UPLOADING]: { min: 0, max: 30 },
    [VALID_STATUSES.PROCESSING]: { min: 30, max: 90 },
    [VALID_STATUSES.READY]: { min: 100, max: 100 },
    [VALID_STATUSES.FAILED]: { min: 0, max: 0 },
  };
  
  const progressStore = new Map();
  
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  const MAX_ENTRY_AGE = 24 * 60 * 60 * 1000;
  
  const isValidStatus = (status) => {
    return Object.values(VALID_STATUSES).includes(status);
  };
  
  const isValidProgress = (status, progress) => {
    if (!isValidStatus(status)) return false;
    const range = PROGRESS_RANGES[status];
    return progress >= range.min && progress <= range.max;
  };
  
  const updateProgress = (fileId, status, progress, additionalData = {}) => {
    try {
      if (!fileId || typeof fileId !== "string") return false;
      if (!isValidStatus(status)) return false;
      if (typeof progress !== "number" || progress < 0 || progress > 100) return false;
  
      const progressEntry = {
        fileId,
        status,
        progress: Math.round(progress),
        timestamp: new Date(),
        lastUpdated: new Date().toISOString(),
        ...additionalData,
      };
  
      progressStore.set(fileId, progressEntry);
      return true;
    } catch {
      return false;
    }
  };
  
  const getProgress = (fileId) => {
    try {
      if (!fileId || typeof fileId !== "string") return null;
      const progressData = progressStore.get(fileId);
      if (!progressData) return null;
  
      const entryAge = Date.now() - progressData.timestamp.getTime();
      if (entryAge > MAX_ENTRY_AGE) {
        progressStore.delete(fileId);
        return null;
      }
      return progressData;
    } catch {
      return null;
    }
  };
  
  const deleteProgress = (fileId) => {
    try {
      if (!fileId || typeof fileId !== "string") return false;
      return progressStore.delete(fileId);
    } catch {
      return false;
    }
  };
  
  const getAllProgress = (includeExpired = false) => {
    try {
      const allEntries = Array.from(progressStore.entries()).map(([fileId, data]) => ({
        fileId,
        ...data,
      }));
  
      if (!includeExpired) {
        const currentTime = Date.now();
        return allEntries.filter((entry) => {
          const entryAge = currentTime - entry.timestamp.getTime();
          return entryAge <= MAX_ENTRY_AGE;
        });
      }
      return allEntries;
    } catch {
      return [];
    }
  };
  
  const cleanupOldEntries = () => {
    try {
      const currentTime = Date.now();
      let cleanedCount = 0;
  
      for (const [fileId, data] of progressStore.entries()) {
        const entryAge = currentTime - data.timestamp.getTime();
        if (entryAge > MAX_ENTRY_AGE) {
          progressStore.delete(fileId);
          cleanedCount++;
        }
      }
      return cleanedCount;
    } catch {
      return 0;
    }
  };
  
  const getStats = () => {
    try {
      const allEntries = getAllProgress(true);
      const activeEntries = getAllProgress(false);
  
      const statusCounts = allEntries.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      }, {});
  
      return {
        totalEntries: allEntries.length,
        activeEntries: activeEntries.length,
        expiredEntries: allEntries.length - activeEntries.length,
        statusDistribution: statusCounts,
        lastCleanup: new Date().toISOString(),
      };
    } catch (error) {
      return {
        totalEntries: 0,
        activeEntries: 0,
        expiredEntries: 0,
        statusDistribution: {},
        error: error.message,
      };
    }
  };
  
  const cleanupInterval = setInterval(() => {
    cleanupOldEntries();
  }, CLEANUP_INTERVAL / 24);
  
  const stopCleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  };
  
  module.exports = {
    updateProgress,
    getProgress,
    deleteProgress,
    getAllProgress,
    cleanupOldEntries,
    getStats,
    stopCleanup,
    VALID_STATUSES,
    PROGRESS_RANGES,
    progressStore,
    isValidStatus,
    isValidProgress,
  };
  