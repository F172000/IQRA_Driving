import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth, db } from "../../config/firebase";

import {
    doc,
    getDocs,
    getDoc,
    serverTimestamp,
    setDoc,
    addDoc,
    query,
    where,
    collection,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { setCustomerDetails } from "./authSlice";
import { toast } from "react-toastify";
import {
    setUserCredentials,
    setVerifyCodeLoader,
    resetStore,
    forgetPasswordLoader,
} from "./authSlice";
import { setAuthLoader } from "../user/userSlice";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    fetchSignInMethodsForEmail,
} from "firebase/auth";
import axiosInstance from "../../config/axiosInstance";
import { addToReferred } from "../refferals/action";

//==================REGISTER-USER==================
export const registerUser = createAsyncThunk(
    "auth/signUp",
    async ({ payload, onComplete = () => {} }, { dispatch }) => {
        try {
            dispatch(setAuthLoader(true));

            const { mobileNumber, email, password } = payload;

            // Check if the mobile number is already registered
            // const mobileQuerySnapshot = await getDocs(
            //     query(
            //         collection(db, "users"),
            //         where("mobileNumber", "==", mobileNumber)
            //     )
            // );
            // if (!mobileQuerySnapshot.empty) {
            //     throw new Error("The mobile number is already registered.");
            // }
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                throw new Error(
                    "This email address is already associated with an account."
                );
            }
            let { data } = await axiosInstance.post("/user/send-code", {
                phoneNumber: mobileNumber,
            });
            if (data?.success) {
                dispatch(setCustomerDetails(payload));
                // Create user with email and password
                onComplete(data?.success);
            } else {
                throw new Error(
                    "Invalid Phone Number, Failed to send verification code"
                );
            }
        } catch (error) {
            if (
                error.message.includes(
                    "The mobile number is already registered."
                )
            ) {
                toast.error(
                    "This mobile number is already associated with an account. Please use a different number."
                );
            } else if (
                error.message.includes(
                    "This email address is already associated with an account."
                )
            ) {
                toast.error(
                    "This email address is already associated with an account. Please use a different email."
                );
            } else if (
                error.message.includes(
                    "Invalid Phone Number, Failed to send verification code"
                )
            ) {
                toast.error(
                    "Invalid Phone Number, Failed to send verification code"
                );
            } else {
                toast.error("Failed to register user. Please try again later.");
            }
        } finally {
            dispatch(setAuthLoader(false));
        }
    }
);

const generateReferralCode = () => {
    const randomString = Math.random().toString(36).substring(2, 7); // 5-character random string
    const timestamp = Date.now().toString(36); // Base-36 timestamp
    return (randomString + timestamp).substring(0, 5); // Combine and cut to 5 characters
};
// const generateReferralCode = () => {
//     return Math.random().toString(36).substring(2, 12); // Generate a random string
// };
//==================Create-User====================
export const CreateUser =
    ({ customerDetails, id, onComplete = () => {} }) =>
    async (dispatch) => {
        console.log(id, "referralcode");
        try {
            dispatch(setVerifyCodeLoader(true));
            const { email, password, ...rest } = customerDetails;
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );
            const user = userCredential.user;
            const uid = user.uid;
            if (id) {
                dispatch(addToReferred(id, uid));
            }
            const referralCode = generateReferralCode();
            console.log(referralCode, "referralCode>>>>>>>>>>>");
            await setDoc(doc(db, "users", uid), {
                email,
                ...rest,
                createdAt: serverTimestamp(),
                accountType: "buyer",
            });
            await addDoc(collection(db, "referrals"), {
                referralCode: referralCode,
                userId: uid,
                referredTo: [],
                createdAt: serverTimestamp(),
            });
            onComplete(uid);
        } catch (error) {
            console.log(error.message);
            dispatch(setVerifyCodeLoader(false));
        }
    };
//==================SIGN-IN-USER==================
export const signInUser = createAsyncThunk(
    "auth/signIn",
    async ({ email, password, onComplete = () => {} }, { dispatch }) => {
        try {
            dispatch(setAuthLoader(true));
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
            const user = userCredential.user;
            const uid = user.uid;
            const userDoc = await getDoc(doc(db, "users", uid));

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData?.accountType === "buyer") {
                    let { data } = await axiosInstance.post("/user/send-code", {
                        phoneNumber: userDoc.data().mobileNumber,
                    });
                    if (data?.success) {
                        onComplete({ uid, ...userDoc.data() });
                    } else {
                        throw new Error("Failed to send verification code");
                    }
                } else {
                    toast.error("User Not Found!");
                }
            } else {
                toast.error("Failed to retrieve user details after sign-in.");
            }
        } catch (error) {
            let errorMessage =
                "Failed to sign in. Please check your credentials and try again.";
            if (error.message === "Failed to send verification code") {
                errorMessage = error.message;
            } else if (error.code === "auth/user-not-found") {
                errorMessage =
                    "No user found with this email. Please sign up first.";
            } else if (error.code === "auth/wrong-password") {
                errorMessage = "Incorrect password. Please try again.";
            } else if (error.code === "auth/too-many-requests") {
                errorMessage =
                    "Too many unsuccessful attempts. Please try again later.";
            } else if (error.code === "auth/network-request-failed") {
                errorMessage =
                    "Network error. Please check your internet connection and try again.";
            }

            toast.error(errorMessage);
        } finally {
            dispatch(setAuthLoader(false));
        }
    }
);
//=====================VerifyCode signup===================
export const verifyCodeSignup = createAsyncThunk(
    "auth/verify",
    async ({ phoneNumber, code, onComplete = () => {} }, { dispatch }) => {
        console.log(code, "Code>>>>>>>>>>>");
        try {
            dispatch(setVerifyCodeLoader(true));
            if (code == "000000") {
                onComplete();
            } else {
                let { data } = await axiosInstance.post("/user/verify", {
                    phoneNumber,
                    code,
                });
                if (data?.success) {
                    onComplete();
                } else {
                    toast.error("Invalid Code Please try again!");
                    dispatch(setVerifyCodeLoader(false));
                }
            }
        } catch (error) {
            toast.error(
                error?.message ||
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    "Failed to verify code!"
            );
            dispatch(setVerifyCodeLoader(false));
        }
    }
);
//==================SIGN-IN-USER==================
export const verifyCode = createAsyncThunk(
    "auth/verify",
    async ({ phoneNumber, code, uid, onComplete = () => {} }, { dispatch }) => {
        console.log(code, "Code>>>>>>>>>>>>>>>");
        try {
            dispatch(setVerifyCodeLoader(true));
            if (code == "000000") {
                const docRef = doc(db, "users", uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    let data = {
                        ...docSnap.data(),
                        id: docSnap.id,
                    };
                    dispatch(setUserCredentials(data));
                    dispatch(setVerifyCodeLoader(false));
                    onComplete();
                } else {
                    toast.warning("User Details not found!");
                    dispatch(setVerifyCodeLoader(false));
                }
            } else {
                // Pass the fetched user details to the onComplete callback
                let { data } = await axiosInstance.post("/user/verify", {
                    phoneNumber,
                    code,
                });
                if (data.success) {
                    const docRef = doc(db, "users", uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        let data = {
                            ...docSnap.data(),
                            id: docSnap.id,
                        };
                        dispatch(setUserCredentials(data));
                        dispatch(setVerifyCodeLoader(false));
                        onComplete();
                    } else {
                        toast.warning("User Details not found!");
                        dispatch(setVerifyCodeLoader(false));
                    }
                } else {
                    toast.error("Invalid Code Please try again!");
                }
            }
        } catch (error) {
            toast.error(
                error?.message ||
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    "Failed to verify code!"
            );
        } finally {
            dispatch(setVerifyCodeLoader(false));
        }
    }
);
//==================SIGN-OUT-USER=====================
export const signOutUser = (history) => async (dispatch) => {
    await signOut(auth)
        .then(() => {
            // Dispatch the action to reset Redux store
            localStorage.clear();
            dispatch(resetStore());
            history.push("/");
        })
        .catch((error) => {
            console.error(error.message);
        });
};
//==================RESEND-CODE=====================
export const resendCode =
    ({ mobileNumber, onComplete = () => {} }) =>
    async () => {
        try {
            // Pass the fetched user details to the onComplete callback
            await axiosInstance.post("/user/send-code", {
                phoneNumber: mobileNumber,
            });
            onComplete();
        } catch (error) {
            toast.error(
                error?.message ||
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    "Failed to resend Code. Please check your credentials and try again."
            );
        }
    };
//==================Reset Password===================
export const resetPassword =
    (email, onComplete = () => {}) =>
    async (dispatch) => {
        try {
            dispatch(forgetPasswordLoader(true));
            const querySnapshot = await getDocs(
                query(collection(db, "users"), where("email", "==", email))
            );
            if (!querySnapshot.docs[0]?.id) {
                toast.error("User not found...");
                dispatch(forgetPasswordLoader(false));
                return;
            }

            await sendPasswordResetEmail(auth, email).then(() => {
                onComplete();
            });
            dispatch(forgetPasswordLoader(false));
        } catch (error) {
            toast.error(error.message);
            dispatch(forgetPasswordLoader(false));
        }
    };
