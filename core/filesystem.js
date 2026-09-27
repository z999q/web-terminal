// core/filesystem.js

const DB_NAME = "web-terminal-db";
const DB_VERSION = 1;
const STORE_NAME = "filesystem";
const ROOT_KEY = "root";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


export class FileSystem {
  constructor() {
    this.root = null;
    this.ready = this.load();
  }


  /* -------------------------------------------------------
   * Initial filesystem
   * ------------------------------------------------------- */

  createDefaultFS() {
    return {
      type: "dir",

      children: {
        home: {
          type: "dir",

          children: {
            aashu: {
              type: "dir",

              children: {
                Desktop: {
                  type: "dir",
                  children: {}
                },

                Documents: {
                  type: "dir",
                  children: {}
                },

                Downloads: {
                  type: "dir",
                  children: {}
                },

                projects: {
                  type: "dir",
                  children: {}
                }
              }
            }
          }
        },

        tmp: {
          type: "dir",
          children: {}
        },

        etc: {
          type: "dir",
          children: {}
        }
      }
    };
  }


  /* -------------------------------------------------------
   * Load filesystem from IndexedDB
   * ------------------------------------------------------- */

  async load() {
    try {
      const db = await openDB();

      const root = await new Promise(
        (resolve, reject) => {
          const tx = db.transaction(
            STORE_NAME,
            "readonly"
          );

          const store = tx.objectStore(
            STORE_NAME
          );

          const request =
            store.get(ROOT_KEY);

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            reject(request.error);
          };
        }
      );

      db.close();

      if (root) {
        this.root = root;
      } else {
        this.root = this.createDefaultFS();
        await this.save();
      }

    } catch (error) {
      console.error(
        "Filesystem load failed:",
        error
      );

      this.root = this.createDefaultFS();
    }

    return this.root;
  }


  /* -------------------------------------------------------
   * Save filesystem
   * ------------------------------------------------------- */

  async save() {
    if (!this.root) return;

    try {
      const db = await openDB();

      await new Promise(
        (resolve, reject) => {
          const tx = db.transaction(
            STORE_NAME,
            "readwrite"
          );

          const store =
            tx.objectStore(STORE_NAME);

          const request =
            store.put(
              this.root,
              ROOT_KEY
            );

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(request.error);
          };
        }
      );

      db.close();

    } catch (error) {
      console.error(
        "Filesystem save failed:",
        error
      );
    }
  }


  /* -------------------------------------------------------
   * Normalize path
   * ------------------------------------------------------- */

  normalize(path, cwd = "/") {
    if (!path) {
      return cwd;
    }

    let fullPath;

    if (path.startsWith("/")) {
      fullPath = path;
    } else {
      fullPath =
        cwd.replace(/\/+$/, "") +
        "/" +
        path;
    }

    const parts = fullPath.split("/");
    const result = [];

    for (const part of parts) {
      if (!part || part === ".") {
        continue;
      }

      if (part === "..") {
        result.pop();
      } else {
        result.push(part);
      }
    }

    return "/" + result.join("/");
  }


  /* -------------------------------------------------------
   * Get node
   * ------------------------------------------------------- */

  get(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    if (normalized === "/") {
      return this.root;
    }

    const parts =
      normalized
        .split("/")
        .filter(Boolean);

    let node = this.root;

    for (const part of parts) {
      if (
        !node ||
        node.type !== "dir" ||
        !node.children[part]
      ) {
        return null;
      }

      node = node.children[part];
    }

    return node;
  }


  /* -------------------------------------------------------
   * Parent
   * ------------------------------------------------------- */

  parent(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    if (normalized === "/") {
      return null;
    }

    const index =
      normalized.lastIndexOf("/");

    if (index === 0) {
      return "/";
    }

    return normalized.slice(
      0,
      index
    );
  }


  /* -------------------------------------------------------
   * Basename
   * ------------------------------------------------------- */

  basename(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    if (normalized === "/") {
      return "/";
    }

    return normalized
      .split("/")
      .filter(Boolean)
      .pop();
  }


  /* -------------------------------------------------------
   * mkdir
   * ------------------------------------------------------- */

  mkdir(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    if (normalized === "/") {
      throw new Error(
        "cannot create root directory"
      );
    }

    if (this.get(normalized)) {
      throw new Error(
        `${path}: File exists`
      );
    }

    const parentPath =
      this.parent(normalized);

    const parent =
      this.get(parentPath);

    if (!parent) {
      throw new Error(
        `${path}: No such file or directory`
      );
    }

    if (parent.type !== "dir") {
      throw new Error(
        `${path}: Not a directory`
      );
    }

    parent.children[
      this.basename(normalized)
    ] = {
      type: "dir",
      children: {}
    };

    this.save();
  }


  /* -------------------------------------------------------
   * touch
   * ------------------------------------------------------- */

  touch(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    const existing =
      this.get(normalized);

    if (existing) {
      if (existing.type !== "file") {
        throw new Error(
          `${path}: Is a directory`
        );
      }

      return;
    }

    const parentPath =
      this.parent(normalized);

    const parent =
      this.get(parentPath);

    if (!parent) {
      throw new Error(
        `${path}: No such file or directory`
      );
    }

    parent.children[
      this.basename(normalized)
    ] = {
      type: "file",
      content: ""
    };

    this.save();
  }


  /* -------------------------------------------------------
   * Remove
   * ------------------------------------------------------- */

  remove(path, cwd = "/") {
    const normalized =
      this.normalize(path, cwd);

    if (normalized === "/") {
      throw new Error(
        "cannot remove root"
      );
    }

    const parentPath =
      this.parent(normalized);

    const parent =
      this.get(parentPath);

    const name =
      this.basename(normalized);

    if (
      !parent ||
      !parent.children[name]
    ) {
      throw new Error(
        `${path}: No such file or directory`
      );
    }

    delete parent.children[name];

    this.save();
  }


  /* -------------------------------------------------------
   * Write file
   * ------------------------------------------------------- */

  writeFile(
    path,
    content,
    cwd = "/"
  ) {
    const normalized =
      this.normalize(path, cwd);

    const existing =
      this.get(normalized);

    if (
      existing &&
      existing.type === "dir"
    ) {
      throw new Error(
        `${path}: Is a directory`
      );
    }

    if (existing) {
      existing.content = content;
    } else {
      const parentPath =
        this.parent(normalized);

      const parent =
        this.get(parentPath);

      if (!parent) {
        throw new Error(
          `${path}: No such file or directory`
        );
      }

      parent.children[
        this.basename(normalized)
      ] = {
        type: "file",
        content
      };
    }

    this.save();
  }


  /* -------------------------------------------------------
   * Read file
   * ------------------------------------------------------- */

  readFile(path, cwd = "/") {
    const node =
      this.get(path, cwd);

    if (!node) {
      throw new Error(
        `${path}: No such file or directory`
      );
    }

    if (node.type !== "file") {
      throw new Error(
        `${path}: Is a directory`
      );
    }

    return node.content;
  }


  /* -------------------------------------------------------
   * List
   * ------------------------------------------------------- */

  list(path = ".", cwd = "/") {
    const node =
      this.get(path, cwd);

    if (!node) {
      throw new Error(
        `${path}: No such file or directory`
      );
    }

    if (node.type === "file") {
      return [
        {
          name: this.basename(path, cwd),
          node
        }
      ];
    }

    return Object.entries(
      node.children
    ).map(([name, child]) => ({
      name,
      node: child
    }));
  }
}
