import { describe, it, expect } from "vitest";
import WebinyError from "@webiny/error";
import { decrypt, encrypt } from "~/crud/settings/password";

const secret = "someReallySecretSecretWithRandomNumbersOrLettersOrSomethingElse";
const password = "GZPJWYVIYnUX99dGnk1N";

describe("password decrypt and encrypt", () => {
    it("should encrypt and decrypt password", async () => {
        const encryptResult = encrypt({
            secret,
            value: password
        });

        expect(encryptResult).toEqual(expect.any(String));

        const decryptResult = decrypt({
            secret,
            value: encryptResult
        });

        expect(decryptResult).toEqual(password);
    });

    it("should return empty string when value is missing", () => {
        expect(
            encrypt({
                secret,
                value: undefined
            })
        ).toBe("");

        expect(
            decrypt({
                secret,
                value: undefined
            })
        ).toBe("");
    });

    it("should require the secret parameter", () => {
        expect(() =>
            encrypt({
                value: password
            })
        ).toThrow(WebinyError);

        expect(() =>
            decrypt({
                value: password
            })
        ).toThrow(WebinyError);
    });

    it("should throw when encrypted value cannot be decoded", () => {
        expect(() =>
            decrypt({
                secret,
                value: "invalid-value"
            })
        ).toThrow(WebinyError);
    });
    /**
     * All these values are encrypted "password" word.
     * We must make sure that after each encryption, it is decryptable.
     */
    const encryptedValues: [number, string][] = [
        [1, "U2FsdGVkX19N+tZuIEBCAIiUTbEAVztC1C9YkOC+b+k="],
        [2, "U2FsdGVkX196nYqxam8yKqTaVtsweCLM7+HbOXgKb4k="],
        [3, "U2FsdGVkX18Gh1O4v6A7O1I8KMbqu5FkkFc/86YuHfA="],
        [4, "U2FsdGVkX19IDvjoAPnMZwFrTPPAUh8ApkMYM9VhRoc="]
    ];

    it.each(encryptedValues)(`should decrypt "password" - %s`, async (_, value) => {
        const result = decrypt({
            secret: "someReallySecretSecret",
            value
        });
        expect(result).toEqual("password");
    });
});
