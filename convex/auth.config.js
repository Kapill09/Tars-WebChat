export default {
    providers: [
        {
            domain: process.env.NEXT_PUBLIC_CLERK_ISSUER_URL,
            applicationID: "convex",
        },
    ],
};
