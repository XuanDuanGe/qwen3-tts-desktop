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

  return (
    <div
      className={`audio-files-page__item${isSelected ? ' audio-files-page__item--active' : ''}`}
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
      <span className="audio-files-page__item-name">{name}</span>
      <span className="audio-files-page__item-actions">
        <button
          type="button"
          className="audio-files-page__icon-button"
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
          className={`audio-files-page__icon-button${isDeleting ? ' audio-files-page__icon-button--danger' : ''}`}
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
    <section className="audio-files-page">
      <header className="audio-files-page__header">
        <div>
          <p className="audio-files-page__eyebrow">AUDIO FILES</p>
          <h1>音频文件</h1>
        </div>
      </header>

      <section className="audio-files-page__preview">
        <div className="audio-files-page__preview-header">
          <div>
            <h2>{selectedArtifact?.fileName ? formatArtifactName(selectedArtifact.fileName) : '暂无音频'}</h2>
            <p>
              {selectedArtifact
                ? `生成时间：${new Date(selectedArtifact.createdAt).toLocaleString()}`
                : '点击下方列表中的音频文件进行预览。'}
            </p>
          </div>
          <button
            className="audio-files-page__action-button"
            type="button"
            disabled={!selectedArtifact || !audioUrl || busyArtifactId === audioArtifactId}
            onClick={handlePreviewDownload}
          >
            <FiDownload aria-hidden="true" />
            下载
          </button>
        </div>
        {selectedArtifact && audioUrl && audioArtifactId === selectedArtifact.artifactId ? (
          <audio controls src={audioUrl} />
        ) : (
          <p className="audio-files-page__empty">暂无可预览的音频。</p>
        )}
      </section>

      {pageError ? <p className="audio-files-page__error">{pageError}</p> : null}

      <section className="audio-files-page__list">
        {loading ? (
          <p className="audio-files-page__empty">音频文件加载中…</p>
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
          <p className="audio-files-page__empty">没有找到音频文件。</p>
        )}
      </section>
    </section>
  );
}
