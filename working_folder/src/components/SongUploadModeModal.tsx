import React from 'react';

import Button from './Button';
import Modal from './Modal';
import useUploadModal from '../hooks/useUploadModal';

const SongUploadModeModal: React.FC = () => {
  const uploadModal = useUploadModal();
  const isOpen = uploadModal.isModePickerOpen;

  const handleClose = () => {
    uploadModal.closePicker();
  };

  const handleSelectSingle = () => {
    uploadModal.openSingle();
  };

  const handleSelectAlbum = () => {
    uploadModal.openAlbum();
  };

  return (
    <Modal
      isOpen={isOpen}
      onChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      title="What do you want to publish?"
      description="Choose to upload a single track or multiple files for an album."
    >
      <div className="flex flex-col gap-3">
        <Button type="button" onClick={handleSelectSingle}>
          Upload a single track
        </Button>
        <Button
          type="button"
          onClick={handleSelectAlbum}
          className="bg-sky-600 text-white hover:opacity-90"
        >
          Upload an album / multiple tracks
        </Button>
      </div>
    </Modal>
  );
};

export default SongUploadModeModal;
