import {
  deleteProjectImage,
  downloadProjectImage,
  uploadProjectImage,
} from "../../lib/storage/project-images.js";

export type MediaStorage = {
  readonly upload: typeof uploadProjectImage;
  readonly delete: typeof deleteProjectImage;
  readonly download: typeof downloadProjectImage;
};

export const projectMediaStorage: MediaStorage = {
  upload: uploadProjectImage,
  delete: deleteProjectImage,
  download: downloadProjectImage,
};
