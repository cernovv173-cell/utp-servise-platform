import {
  type SupportedMediaType,
  deleteProjectImage,
  downloadProjectMedia,
  uploadProjectMedia,
} from "../../lib/storage/project-images.js";

export type MediaStorage = {
  readonly upload: (
    bytes: Buffer,
    contentType: SupportedMediaType,
  ) => Promise<string>;
  readonly delete: typeof deleteProjectImage;
  readonly download: typeof downloadProjectMedia;
};

export const projectMediaStorage: MediaStorage = {
  upload: uploadProjectMedia,
  delete: deleteProjectImage,
  download: downloadProjectMedia,
};
