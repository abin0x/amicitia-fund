import { registerPlugin } from "@capacitor/core";

export type SaveFileResult = {
  uri: string;
  displayPath: string;
};

type DownloadSaverPlugin = {
  saveFileToDownloads(options: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    subdirectory?: string;
  }): Promise<SaveFileResult>;
};

export const DownloadSaver = registerPlugin<DownloadSaverPlugin>("DownloadSaver");
