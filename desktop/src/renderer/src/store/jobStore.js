import { create } from 'zustand';
import { cancelJob, getJob, submitJob } from '../api/engine';

const useJobStore = create((set) => ({
  jobs: {},
  error: null,
  submit: async (params) => {
    try {
      const job = await submitJob(params);
      set((state) => {
        const current = state.jobs[job.jobId];
        return {
          jobs: {
            ...state.jobs,
            [job.jobId]: current
              ? { ...job, ...current }
              : job,
          },
          error: null,
        };
      });
      return job;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
  get: async (jobId) => {
    const job = await getJob(jobId);
    set((state) => ({ jobs: { ...state.jobs, [job.jobId]: job } }));
    return job;
  },
  cancel: async (jobId) => {
    const job = await cancelJob(jobId);
    set((state) => ({ jobs: { ...state.jobs, [job.jobId]: job } }));
    return job;
  },
  update: (job) =>
    set((state) => ({ jobs: { ...state.jobs, [job.jobId]: job } })),
}));

export default useJobStore;
