import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { DownloadSaver } from "@/plugins/download-saver";

export const REPORTS_DIRECTORY = "Amicitia";
export const isNativePlatform = Capacitor.isNativePlatform();

export const getSafeReportFileName = (title: string, extension: "pdf" | "csv") =>
  `report-${title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}.${extension}`;

export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to convert file"));
        return;
      }
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

export const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const saveBlobToNativeDownloads = async (blob: Blob, fileName: string, mimeType: string) => {
  const base64Data = await blobToBase64(blob);
  return DownloadSaver.saveFileToDownloads({
    fileName,
    mimeType,
    base64Data,
    subdirectory: REPORTS_DIRECTORY,
  });
};

export const saveBlobToNativeCache = async (blob: Blob, fileName: string) => {
  const base64Data = await blobToBase64(blob);
  const targetPath = `${REPORTS_DIRECTORY}/${fileName}`;

  await Filesystem.mkdir({
    path: REPORTS_DIRECTORY,
    directory: Directory.Cache,
    recursive: true,
  }).catch(() => {});

  const savedFile = await Filesystem.writeFile({
    path: targetPath,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  return {
    uri: savedFile.uri,
    displayPath: `Cache/${REPORTS_DIRECTORY}/${fileName}`,
  };
};

export const shareNativeFile = async (fileUri: string, title: string) => {
  await Share.share({
    title,
    text: title,
    url: fileUri,
    dialogTitle: "Share report",
  });
};
