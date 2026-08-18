import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiDownload, FiTrash2 } from 'react-icons/fi';
import {
  deleteArtifact,
  downloadArtifact,
  listArtifacts,
  onArtifactCreated,
  readArtifact,
} from '../api/engine';
import { track } from '../api/telemetry';
import useMessageStore from '../store/messageStore';
import { toBytes } from '../features/voice-generate/utils';

const SELECT_DEBOUNCE_MS = 120;
const pageClass = 'mx-auto max-w-[760px] px-7 pb-12 pt-8';
const headerClass = 'mb-6 flex items-center justify-between gap-4';
const eyebrowClass = 'mb-1.5 text-[11px] font-bold tracking-[0.14em] text-primary';
const titleClass = 'm-0 text-2xl font-semibold text-text';
const previewClass = 'mt-5 rounded-ui border border-border bg-panel p-4';
const actionButtonClass =
  'inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-ui border border-primary bg-transparent px-3.5 font-semibold text-primary transition hover:bg-primary hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const iconButtonClass =
  'grid h-9 w-9 min-w-[36px] place-items-center rounded-ui border border-primary bg-transparent p-0 text-primary transition hover:bg-primary hover:text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function formatArtifactName(fileName = '') {
  return fileName.replace(/\.wav$/i, '');
}

const AudioFilesRow = memo(function AudioFilesRow({
  artifact,
  isSelected,
  isDeleting,
  isBusy,
  onSelect,
  onDownload,
  onDelete,
}) {
  const name = formatArtifactName(artifact.fileName) || artifact.fileName || '';
  const rowClass = `grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-ui border px-3.5 py-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
    isSelected
      ? 'border-primary bg-[#21262a]'
      : 'border-border bg-panel hover:border-primary hover:bg-[#21262a]'
  }`;

  return (
    <div
      className={rowClass}
      role="button"
      tabIndex={0}
      title={name}
      onClick={() => onSelect(artifact.artifactId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(artifact.artifactId);
        }
      }}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text">
        {name}
      </span>
      <span className="inline-flex gap-2">
        <button
          type="button"
          className={iconButtonClass}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(artifact.artifactId);
          }}
          disabled={isBusy}
          aria-label="下载音频"
        >
          <FiDownload aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${iconButtonClass} ${
            isDeleting
              ? 'border-danger text-danger hover:bg-danger'
              : ''
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(artifact.artifactId);
          }}
          disabled={isBusy}
          aria-label="删除音频"
        >
          <FiTrash2 aria-hidden="true" />
        </button>
      </span>
    </div>
  );
});

export default function AudioFilesPage() {
  const pushMessage = useMessageStore((state) => state.push);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioArtifactId, setAudioArtifactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [busyArtifactId, setBusyArtifactId] = useState('');
  const selectTimerRef = useRef(null);
  const artifactsRef = useRef([]);
  const selectedArtifactIdRef = useRef('');
  const deleteConfirmIdRef = useRef('');

  const selectedArtifact = useMemo(
    () => artifacts.find((item) => item.artifactId === selectedArtifactId) || null,
    [artifacts, selectedArtifactId],
  );

  useEffect(() => {
    artifactsRef.current = artifacts;
  }, [artifacts]);

  useEffect(() => {
    selectedArtifactIdRef.current = selectedArtifactId;
  }, [selectedArtifactId]);

  useEffect(() => {
    deleteConfirmIdRef.current = deleteConfirmId;
  }, [deleteConfirmId]);

  const clearSelectTimer = useCallback(() => {
    if (selectTimerRef.current) {
      globalThis.clearTimeout(selectTimerRef.current);
      selectTimerRef.current = null;
    }
  }, []);

  const refreshArtifacts = useCallback(async (preferredId = '') => {
    setLoading(true);
    try {
      const result = await listArtifacts();
      const nextArtifacts = result.artifacts || [];
      setArtifacts(nextArtifacts);
      setPageError('');
      if (!nextArtifacts.length) {
        setSelectedArtifactId('');
        return;
      }
      const currentSelectedId = selectedArtifactIdRef.current;
      const nextSelected =
        nextArtifacts.find((item) => item.artifactId === preferredId) ||
        nextArtifacts.find((item) => item.artifactId === currentSelectedId) ||
        nextArtifacts[0];
      setSelectedArtifactId(nextSelected.artifactId);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    track('component_used', { component: 'audio_files_page' }, { once: true });
    const timer = globalThis.setTimeout(() => {
      void refreshArtifacts();
    }, 0);
    const unsubscribe = onArtifactCreated((artifact) => {
      setArtifacts((state) => {
        const next = [artifact, ...state.filter((item) => item.artifactId !== artifact.artifactId)];
        next.sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
        return next;
      });
      setPageError('');
      setLoading(false);
      setDeleteConfirmId('');
      setSelectedArtifactId((current) => current || artifact.artifactId);
    });
    return () => {
      globalThis.clearTimeout(timer);
      clearSelectTimer();
      unsubscribe();
    };
  }, [clearSelectTimer, refreshArtifacts]);

  useEffect(() => {
    if (!selectedArtifact?.artifactId) {
      setAudioArtifactId('');
      setAudioUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return '';
      });
      return undefined;
    }
    let active = true;
    let nextUrl = '';
    readArtifact(selectedArtifact.artifactId)
      .then((value) => {
        if (!active) {
          return;
        }
        nextUrl = URL.createObjectURL(
          new Blob([toBytes(value)], {
            type: selectedArtifact.mimeType || 'audio/wav',
          }),
        );
        setAudioUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return nextUrl;
        });
        setAudioArtifactId(selectedArtifact.artifactId);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPageError(error.message);
        setAudioArtifactId('');
      });
    return () => {
      active = false;
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [selectedArtifact?.artifactId, selectedArtifact?.mimeType]);

  async function handlePreviewDownload() {
    if (!selectedArtifact) {
      return;
    }
    setBusyArtifactId(selectedArtifact.artifactId);
    pushMessage({ level: 'info', content: '开始下载音频文件。' });
    try {
      await downloadArtifact(selectedArtifact.artifactId);
      pushMessage({ level: 'success', content: '音频文件下载完成。' });
    } catch (error) {
      setPageError(error.message);
      pushMessage({ level: 'error', content: `下载失败：${error.message}` });
    } finally {
      setBusyArtifactId('');
    }
  }

  const handleListDownload = useCallback(
    async (artifactId) => {
      setBusyArtifactId(artifactId);
      pushMessage({ level: 'info', content: '开始下载音频文件。' });
      try {
        await downloadArtifact(artifactId);
        pushMessage({ level: 'success', content: '音频文件下载完成。' });
      } catch (error) {
        setPageError(error.message);
        pushMessage({ level: 'error', content: `下载失败：${error.message}` });
      } finally {
        setBusyArtifactId('');
      }
    },
    [pushMessage],
  );

  const handleDelete = useCallback(
    async (artifactId) => {
      if (deleteConfirmIdRef.current !== artifactId) {
        setDeleteConfirmId(artifactId);
        return;
      }
      clearSelectTimer();
      setBusyArtifactId(artifactId);
      try {
        await deleteArtifact(artifactId);
        const currentArtifacts = artifactsRef.current;
        const deletedIndex = currentArtifacts.findIndex((item) => item.artifactId === artifactId);
        const nextArtifacts = currentArtifacts.filter((item) => item.artifactId !== artifactId);
        const currentSelectedId = selectedArtifactIdRef.current;
        let nextSelectedId = currentSelectedId;
        if (!nextArtifacts.length) {
          nextSelectedId = '';
        } else if (currentSelectedId === artifactId) {
          const fallback = nextArtifacts[deletedIndex] || nextArtifacts[deletedIndex - 1] || nextArtifacts[0];
          nextSelectedId = fallback?.artifactId || '';
        }
        setArtifacts(nextArtifacts);
        setDeleteConfirmId('');
        setSelectedArtifactId(nextSelectedId);
      } catch (error) {
        setPageError(error.message);
      } finally {
        setBusyArtifactId('');
      }
    },
    [clearSelectTimer],
  );

  const handleSelect = useCallback(
    (artifactId) => {
      if (selectedArtifactIdRef.current === artifactId && deleteConfirmIdRef.current !== artifactId) {
        return;
      }
      clearSelectTimer();
      selectTimerRef.current = globalThis.setTimeout(() => {
        setDeleteConfirmId('');
        setSelectedArtifactId(artifactId);
      }, SELECT_DEBOUNCE_MS);
    },
    [clearSelectTimer],
  );

  return (
    <section className={pageClass}>
      <header className={headerClass}>
        <div>
          <p className={eyebrowClass}>AUDIO FILES</p>
          <h1 className={titleClass}>音频文件</h1>
        </div>
      </header>

      <section className={previewClass}>
        <div className="mb-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[17px] font-semibold text-text">
              {selectedArtifact?.fileName ? formatArtifactName(selectedArtifact.fileName) : '暂无音频'}
            </h2>
            <p className="m-0 mt-1 text-xs text-text-muted">
              {selectedArtifact
                ? `生成时间：${new Date(selectedArtifact.createdAt).toLocaleString()}`
                : '点击下方列表中的音频文件进行预览。'}
            </p>
          </div>
          <button
            className={actionButtonClass}
            type="button"
            disabled={!selectedArtifact || !audioUrl || busyArtifactId === audioArtifactId}
            onClick={handlePreviewDownload}
          >
            <FiDownload aria-hidden="true" />
            下载
          </button>
        </div>
        {selectedArtifact && audioUrl && audioArtifactId === selectedArtifact.artifactId ? (
          <audio className="w-full" controls src={audioUrl} />
        ) : (
          <p className="m-0 text-xs text-text-muted">暂无可预览的音频。</p>
        )}
      </section>

      {pageError ? <p className="mt-4 text-[13px] text-danger">{pageError}</p> : null}

      <section className="mt-4 grid gap-2.5">
        {loading ? (
          <p className="m-0 text-xs text-text-muted">音频文件加载中…</p>
        ) : artifacts.length ? (
          artifacts.map((artifact) => {
            const isSelected = artifact.artifactId === selectedArtifactId;
            const isDeleting = deleteConfirmId === artifact.artifactId;
            const isBusy = busyArtifactId === artifact.artifactId;
            return (
              <AudioFilesRow
                key={artifact.artifactId}
                artifact={artifact}
                isSelected={isSelected}
                isDeleting={isDeleting}
                isBusy={isBusy}
                onSelect={handleSelect}
                onDownload={handleListDownload}
                onDelete={handleDelete}
              />
            );
          })
        ) : (
          <p className="m-0 text-xs text-text-muted">没有找到音频文件。</p>
        )}
      </section>
    </section>
  );
}
