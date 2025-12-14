import CryptoJS from "crypto-js";
import WebinyError from "@webiny/error";

interface Params {
    value?: string | null;
    secret?: string | null;
}

type Operation = "encrypt" | "decrypt";

const ensureSecret = (operation: Operation, secret?: string | null): string => {
    if (!secret) {
        throw new WebinyError(
            `Cannot ${operation} password without providing the secret.`,
            "SECRET_ERROR"
        );
    }

    return secret;
};

/**
 * Keeps backwards compatibility by ensuring missing or empty values short-circuit to an empty string.
 */
const normalizeValue = (value?: string | null): string | null => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return value;
};

export const decrypt = (params: Params): string => {
    const secret = ensureSecret("decrypt", params.secret);
    const value = normalizeValue(params.value);

    if (!value) {
        return "";
    }

    try {
        const bytes = CryptoJS.AES.decrypt(value, secret);
        const result = bytes.toString(CryptoJS.enc.Utf8);

        if (!result) {
            throw new WebinyError(
                "Decrypted password could not be converted to a UTF-8 string.",
                "DECRYPT_VALUE_ERROR"
            );
        }

        return result;
    } catch (error) {
        if (error instanceof WebinyError) {
            throw error;
        }

        throw new WebinyError("Could not decrypt the provided password.", "DECRYPT_ERROR", {
            cause: error
        });
    }
};

export const encrypt = (params: Params): string => {
    const secret = ensureSecret("encrypt", params.secret);
    const value = normalizeValue(params.value);

    if (!value) {
        return "";
    }

    try {
        return CryptoJS.AES.encrypt(value, secret).toString();
    } catch (error) {
        throw new WebinyError("Could not encrypt the provided password.", "ENCRYPT_ERROR", {
            cause: error
        });
    }
};
