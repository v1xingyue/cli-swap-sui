import path from "path";
import fs from "fs";

export const getHomePath = () => {
  return process.env.HOME || ".";
};

export const getStoragePath = () => {
  return path.join(getHomePath(), ".cli-swap-sui");
};

export const ensureStoragePath = () => {
  const storagePath = getStoragePath();
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
};

export const getKeysJsonFilePath = () => {
  return path.join(getStoragePath(), "keys.json");
};

const storageFile = getStoragePath();
