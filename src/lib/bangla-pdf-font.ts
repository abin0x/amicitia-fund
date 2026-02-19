import jsPDF from "jspdf";

let fontBase64: string | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function loadBanglaFont(doc: jsPDF): Promise<boolean> {
  if (!fontBase64) {
    const fontUrl = "/fonts/NotoSansBengali.ttf";
    try {
      fontBase64 = await fetchFontAsBase64(fontUrl);
    } catch {
      console.warn("Failed to load local Bangla font, falling back to default");
      return false;
    }
  }

  if (fontBase64) {
    try {
      doc.addFileToVFS("NotoSansBengali.ttf", fontBase64);
      doc.addFont("NotoSansBengali.ttf", "NotoSansBengali", "normal");
      doc.addFont("NotoSansBengali.ttf", "NotoSansBengali", "bold");
      doc.setFont("NotoSansBengali", "normal");
      return true;
    } catch {
      console.warn("Failed to register Bangla font in jsPDF, falling back to default");
      return false;
    }
  }

  return false;
}
