/*
 * ============================================================
 * WEBTERM NMAP
 * Browser-only Nmap-like network scanner
 *
 * IMPORTANT:
 * A browser cannot create raw TCP/UDP sockets.
 * Therefore this performs HTTP/HTTPS probes only.
 * ============================================================
 */

export default {

    description: "Scan HTTP/HTTPS ports",

    async execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "Nmap: usage: nmap [options] <host>"
            );

            terminal.print(
                "Example: nmap localhost"
            );

            terminal.print(
                "Example: nmap -p 80,443 localhost"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * OPTIONS
         * ----------------------------------------------------
         */

        let target = null;

        let ports = [
            21,
            22,
            23,
            25,
            53,
            80,
            110,
            143,
            443,
            445,
            3306,
            5432,
            6379,
            8080,
            8443,
            9090
        ];


        for (
            let i = 0;
            i < args.length;
            i++
        ) {

            const arg = args[i];


            /*
             * -p 80,443,8080
             */

            if (arg === "-p") {

                const value =
                    args[++i];

                if (!value) {

                    terminal.print(
                        "Nmap: option -p requires an argument"
                    );

                    return;
                }

                ports =
                    parsePorts(value);

                if (!ports.length) {

                    terminal.print(
                        "Nmap: invalid port specification"
                    );

                    return;
                }

                continue;
            }


            /*
             * -p80,443
             */

            if (arg.startsWith("-p")) {

                ports =
                    parsePorts(
                        arg.substring(2)
                    );

                if (!ports.length) {

                    terminal.print(
                        "Nmap: invalid port specification"
                    );

                    return;
                }

                continue;
            }


            /*
             * Target
             */

            if (!arg.startsWith("-")) {

                target = arg;

            }

        }


        if (!target) {

            terminal.print(
                "Nmap: missing target"
            );

            return;
        }


        /*
         * ----------------------------------------------------
         * START
         * ----------------------------------------------------
         */

        terminal.print("");

        terminal.print(
            "Starting WebTerm Nmap"
        );

        terminal.print(
            `Target: ${target}`
        );

        terminal.print(
            `Ports: ${ports.join(", ")}`
        );

        terminal.print("");


        /*
         * ----------------------------------------------------
         * Resolve target
         * ----------------------------------------------------
         */

        const hostname =
            cleanHostname(target);


        terminal.print(
            `Nmap scan report for ${hostname}`
        );

        terminal.print("");

        terminal.print(
            "PORT".padEnd(10) +
            "STATE".padEnd(12) +
            "SERVICE"
        );

        terminal.print(
            "--------------------------------"
        );


        /*
         * ----------------------------------------------------
         * Scan
         * ----------------------------------------------------
         */

        for (const port of ports) {

            const result =
                await scanPort(
                    hostname,
                    port
                );


            let state;

            if (result.open) {

                state = "open";

            } else if (result.timeout) {

                state = "filtered";

            } else {

                state = "closed";
            }


            terminal.print(
                `${port}/tcp`.padEnd(10) +
                state.padEnd(12) +
                getServiceName(port)
            );

        }


        /*
         * ----------------------------------------------------
         * Finish
         * ----------------------------------------------------
         */

        terminal.print("");

        terminal.print(
            "Nmap done."
        );

        terminal.print(
            "Note: browser HTTP/HTTPS probing only."
        );

    }

};


/*
 * ============================================================
 * PARSE PORTS
 * ============================================================
 */

function parsePorts(value) {

    const ports = new Set();

    const parts =
        value.split(",");


    for (const part of parts) {

        const item =
            part.trim();


        /*
         * Port range
         *
         * 80-443
         */

        if (item.includes("-")) {

            const [start, end] =
                item.split("-")
                    .map(Number);


            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 1 ||
                end > 65535 ||
                start > end
            ) {

                continue;
            }


            /*
             * Prevent accidentally scanning
             * enormous ranges from the browser.
             */

            if (
                end - start > 1000
            ) {

                continue;
            }


            for (
                let port = start;
                port <= end;
                port++
            ) {

                ports.add(port);

            }

            continue;
        }


        const port =
            Number(item);


        if (
            Number.isInteger(port) &&
            port >= 1 &&
            port <= 65535
        ) {

            ports.add(port);

        }

    }


    return [...ports].sort(
        (a, b) => a - b
    );

}


/*
 * ============================================================
 * CLEAN HOSTNAME
 * ============================================================
 */

function cleanHostname(target) {

    try {

        if (
            target.startsWith("http://") ||
            target.startsWith("https://")
        ) {

            return new URL(target).hostname;

        }

    } catch {

        return target;

    }

    return target
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");

}


/*
 * ============================================================
 * PORT SCANNER
 * ============================================================
 */

async function scanPort(
    hostname,
    port
) {

    /*
     * Port 443 normally uses HTTPS.
     * Other ports are first attempted through HTTP.
     */

    const protocols =
        port === 443 ||
        port === 8443
            ? ["https"]
            : ["http", "https"];


    for (const protocol of protocols) {

        const url =
            `${protocol}://${hostname}:${port}/`;


        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => controller.abort(),
                2500
            );


        try {

            const start =
                performance.now();


            await fetch(
                url,
                {
                    method: "HEAD",

                    mode: "no-cors",

                    cache: "no-store",

                    signal:
                        controller.signal
                }
            );


            const elapsed =
                performance.now() - start;


            clearTimeout(timeout);


            return {

                open: true,

                timeout: false,

                time: elapsed

            };

        } catch (error) {

            clearTimeout(timeout);


            /*
             * Continue to HTTPS if HTTP failed.
             */

        }

    }


    return {

        open: false,

        timeout: false,

        time: null

    };

}


/*
 * ============================================================
 * COMMON SERVICE NAMES
 * ============================================================
 */

function getServiceName(port) {

    const services = {

        21: "ftp",

        22: "ssh",

        23: "telnet",

        25: "smtp",

        53: "dns",

        80: "http",

        110: "pop3",

        143: "imap",

        443: "https",

        445: "microsoft-ds",

        3306: "mysql",

        5432: "postgresql",

        6379: "redis",

        8080: "http-proxy",

        8443: "https-alt",

        9090: "web"

    };


    return (
        services[port] ||
        "unknown"
    );

}
