import moment from "moment-timezone";

global.XMLHttpRequest = require("xhr2");

export class Utility {
    static readonly timeZoneName = "America/Los_Angeles";

    static makeRequest(method: string, url: string): Promise<string> {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open(method, url);
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.responseText);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        });
    }

    static formatTwoDigits(num: number) {
        let result = `${num}`;

        if (num < 10) {
            result = '0' + result;
        }

        return result;
    }

    static formatCurrentTime() {
        return moment().tz(Utility.timeZoneName).format("HH:mm");
    }

    static toString(obj: any) {
        return JSON.stringify(obj);
    }

    static isNumeric(val: string): boolean {
        return !isNaN(parseInt(val));
    }

    static FindChild(node: ChildNode, check: (n: ChildNode) => boolean): ChildNode {
        if (node == null || node.childNodes == null || node.childNodes.length == 0) {
            return null;
        }

        for (let i = 0; i < node.childNodes.length; ++i) {
            let n = node.childNodes[i];
            if (check(n)) {
                return n;
            }
        }

        return null;
    }
}

