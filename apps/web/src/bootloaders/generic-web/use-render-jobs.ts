import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "@/config";
import type { GenericWebRenderJob } from "./workflow";

interface QueueRenderOptions {
  count: number;
  seed?: string;
}

interface UseGenericWebRenderJobsOptions {
  sessionId: string | null;
  authToken: string | null;
  onPreviewSeed?: (seed: string) => void;
  onThumbnailSelected?: (job: GenericWebRenderJob) => void;
}

export function useGenericWebRenderJobs({
  sessionId,
  authToken,
  onPreviewSeed,
  onThumbnailSelected,
}: UseGenericWebRenderJobsOptions) {
  const [renderJobs, setRenderJobs] = useState<Record<string, GenericWebRenderJob>>(
    {}
  );
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(
    null
  );
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const pollersRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      pollersRef.current = {};
    };
  }, []);

  const updateRenderJob = useCallback((jobId: string, job: GenericWebRenderJob) => {
    setRenderJobs((prev) => ({ ...prev, [jobId]: { ...job, jobId } }));
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      if (!sessionId || !authToken) return;
      pollersRef.current[jobId] = true;

      const poll = async () => {
        if (!pollersRef.current[jobId]) return;

        try {
          const response = await fetch(
            `${CONFIG.sandboxWorkerUrl}/sessions/${sessionId}/render/${jobId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );

          if (response.status === 404) {
            setTimeout(poll, 1500);
            return;
          }

          if (!response.ok) {
            throw new Error(await response.text());
          }

          const job = (await response.json()) as GenericWebRenderJob;
          updateRenderJob(jobId, job);

          if (job.state === "complete" || job.state === "error") {
            pollersRef.current[jobId] = false;
            return;
          }

          setTimeout(poll, 2000);
        } catch (error) {
          console.error("Polling render job failed", error);
          pollersRef.current[jobId] = false;
        }
      };

      poll();
    },
    [authToken, sessionId, updateRenderJob]
  );

  const queueRenders = useCallback(
    async ({ count, seed }: QueueRenderOptions) => {
      if (!sessionId || !authToken) return;

      try {
        setIsRendering(true);
        setRenderError(null);

        for (let i = 0; i < count; i += 1) {
          const payload: { seed?: string } = {};
          if (seed) {
            payload.seed = seed;
          }

          const response = await fetch(
            `${CONFIG.sandboxWorkerUrl}/sessions/${sessionId}/render`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify(payload),
            }
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Render request failed");
          }

          const jobId = data.jobId as string;
          updateRenderJob(jobId, {
            jobId,
            state: "processing",
            requestedAt: Date.now(),
            seed: data.seed,
          });
          pollJob(jobId);
        }
      } catch (error) {
        setRenderError(
          error instanceof Error ? error.message : "Render request failed"
        );
        console.error("Render request failed", error);
      } finally {
        setIsRendering(false);
      }
    },
    [authToken, pollJob, sessionId, updateRenderJob]
  );

  const handleJobClick = useCallback(
    (job: GenericWebRenderJob) => {
      if (job.seed) {
        onPreviewSeed?.(job.seed);
      }
    },
    [onPreviewSeed]
  );

  const handleSelectThumbnail = useCallback(
    (jobId: string) => {
      setSelectedThumbnail(jobId);
      const job = renderJobs[jobId];
      if (!job) return;
      onThumbnailSelected?.(job);
    },
    [onThumbnailSelected, renderJobs]
  );

  const reset = useCallback(() => {
    pollersRef.current = {};
    setRenderJobs({});
    setSelectedThumbnail(null);
    setRenderError(null);
  }, []);

  const renderList = useMemo(
    () =>
      Object.entries(renderJobs)
        .map(([jobId, job]) => ({ ...job, jobId }))
        .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0)),
    [renderJobs]
  );

  const activeRenderCount = useMemo(
    () =>
      renderList.filter(
        (job) => job.state === "pending" || job.state === "processing"
      ).length,
    [renderList]
  );

  return {
    activeRenderCount,
    handleJobClick,
    handleSelectThumbnail,
    isRendering,
    queueRenders,
    renderError,
    renderJobs,
    renderList,
    reset,
    selectedThumbnail,
    setRenderError,
  };
}
