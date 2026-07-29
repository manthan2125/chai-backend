import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken'
import { userModel } from "../models/user.model.js";


// Authorization: Bearer <token>
export const verifyJWT = asyncHandler(async (req, _, next) => {
    // kabhi esi situation aegi jhn par res ka usage nhi ho rha hoga whn aap res ki jagah _ laga skte hain - production mein esi chizein milengi
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new ApiError(401, "Unauthorised request")
        }
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await userModel.findById(decodedToken?._id).select("-password -refreshToken")
        if (!user) {
            
            throw new ApiError(401, "Invalid access token")
        }

        req.user = user;
        next();
    }
    catch (err) {
        throw new ApiError(401, err?.message || "Invalid access token")
    }
})