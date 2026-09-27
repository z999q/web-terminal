// commands/python.js

let pyodide = null;
let loadingPromise = null;

export default {
    description: "Run Python code using CPython/WebAssembly",

    async execute(args, terminal) {

        /*
         * python --version
         */
        if (
            args[0] === "--version" ||
            args[0] === "-V"
        ) {
            terminal.print(
                "Python 3.x (Pyodide)"
            );

            return;
        }


        /*
         * python --help
         */
        if (
            args[0] === "--help" ||
            args[0] === "-h"
        ) {
            printHelp(terminal);
            return;
        }


        /*
         * Load Python runtime
         */
        terminal.print(
            "Loading Python runtime..."
        );

        try {

            await loadPython();

        } catch (error) {

            terminal.print(
                `python: failed to load Python runtime: ${error.message}`
            );

            return;
        }


        terminal.print(
            `Python ${pyodide.runPython(
                "import sys; sys.version.split()[0]"
            )}`
        );


        /*
         * python -c "code"
         */
        if (
            args[0] === "-c"
        ) {

            if (!args[1]) {

                terminal.print(
                    "python: option -c requires an argument"
                );

                return;
            }


            await runPythonCode(
                args[1],
                terminal
            );

            return;
        }


        /*
         * python script.py
         */
        if (
            args.length > 0 &&
            !args[0].startsWith("-")
        ) {

            const filename =
                terminal.normalizePath(
                    args[0]
                );


            const node =
                terminal.getNode(
                    filename
                );


            if (!node) {

                terminal.print(
                    `python: can't open file '${args[0]}': No such file or directory`
                );

                return;
            }


            if (
                node.type !== "file"
            ) {

                terminal.print(
                    `python: '${args[0]}' is a directory`
                );

                return;
            }


            await runPythonCode(
                node.content || "",
                terminal
            );

            return;
        }


        /*
         * python with no script
         */
        terminal.print(
            "Python interactive mode"
        );

        terminal.print(
            "Use: python -c \"print('Hello')\""
        );

        terminal.print(
            "Use: python script.py"
        );

        terminal.print(
            "Interactive REPL is not available in the browser terminal yet."
        );
    }
};


/* ============================================================
 * LOAD PYODIDE
 * ============================================================
 */

async function loadPython() {

    if (pyodide) {
        return pyodide;
    }


    if (loadingPromise) {
        return loadingPromise;
    }


    loadingPromise =
        new Promise(
            (resolve, reject) => {

                /*
                 * Already loaded
                 */
                if (
                    window.loadPyodide
                ) {

                    initializePyodide(
                        resolve,
                        reject
                    );

                    return;
                }


                const script =
                    document.createElement(
                        "script"
                    );


                script.src =
                    "https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js";


                script.onload = () => {

                    initializePyodide(
                        resolve,
                        reject
                    );

                };


                script.onerror = () => {

                    reject(
                        new Error(
                            "Could not load Pyodide from CDN"
                        )
                    );

                };


                document.head.appendChild(
                    script
                );

            }
        );


    return loadingPromise;
}


/* ============================================================
 * INITIALIZE PYODIDE
 * ============================================================
 */

async function initializePyodide(
    resolve,
    reject
) {

    try {

        pyodide =
            await window.loadPyodide();


        resolve(
            pyodide
        );

    } catch (error) {

        reject(error);

    }
}


/* ============================================================
 * RUN PYTHON
 * ============================================================
 */

async function runPythonCode(
    code,
    terminal
) {

    try {

        /*
         * Capture stdout/stderr.
         */

        pyodide.runPython(`
import sys
from io import StringIO

__webterm_stdout = StringIO()
__webterm_stderr = StringIO()

sys.stdout = __webterm_stdout
sys.stderr = __webterm_stderr
        `);


        /*
         * Execute code.
         */

        await pyodide.runPythonAsync(
            code
        );


        /*
         * Get output.
         */

        const stdout =
            pyodide.runPython(
                "__webterm_stdout.getvalue()"
            );


        const stderr =
            pyodide.runPython(
                "__webterm_stderr.getvalue()"
            );


        if (stdout) {

            printOutput(
                stdout,
                terminal
            );

        }


        if (stderr) {

            printOutput(
                stderr,
                terminal
            );

        }


    } catch (error) {

        terminal.print(
            formatPythonError(error)
        );

    } finally {

        /*
         * Restore Python stdout/stderr.
         */

        try {

            pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
            `);

        } catch {
            // Ignore cleanup errors.
        }

    }
}


/* ============================================================
 * OUTPUT
 * ============================================================
 */

function printOutput(
    text,
    terminal
) {

    const lines =
        text.replace(
            /\r\n/g,
            "\n"
        ).split("\n");


    /*
     * Avoid an extra blank line when
     * Python output ends with newline.
     */

    if (
        lines.length &&
        lines[lines.length - 1] === ""
    ) {

        lines.pop();

    }


    for (
        const line of lines
    ) {

        terminal.print(line);

    }
}


/* ============================================================
 * PYTHON ERROR
 * ============================================================
 */

function formatPythonError(error) {

    if (
        error &&
        error.message
    ) {

        return error.message;

    }


    return String(error);
}


/* ============================================================
 * HELP
 * ============================================================
 */

function printHelp(terminal) {

    terminal.print(
        "Usage: python [OPTIONS] [SCRIPT]"
    );

    terminal.print("");

    terminal.print(
        "Options:"
    );

    terminal.print(
        "  --version       Show Python version"
    );

    terminal.print(
        "  -V              Show Python version"
    );

    terminal.print(
        "  -c CODE         Execute Python code"
    );

    terminal.print(
        "  -h, --help      Show this help"
    );

    terminal.print("");

    terminal.print(
        "Examples:"
    );

    terminal.print(
        "  python --version"
    );

    terminal.print(
        "  python -c \"print(2 + 3)\""
    );

    terminal.print(
        "  python script.py"
    );
}
