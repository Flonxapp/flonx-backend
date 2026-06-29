/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
// types/express.d.ts or a similar file in your project
declare namespace Express {
  export interface Request {
    files?: {
      product_image?: File[]; // Add more fields as needed, e.g. category_image, profile_image
      // Add other fields you might expect to receive
      profile_image?: File[];
      course_banner?: File[];
      banner?: File[];
      class_banner?: File[];
      icon?: File[];
      sign_image?: File[];
      topic_icon?: File[];
      category_image?: File[];
      video?: File[];
      question_image?: File[];
      topic_image?: File[];
      audio?: File[];
      audio_cover?: File[];
      project_cover?: File[];
      playlist_cover?: File[];
      project_ducument?: File[];
      project_image?: File[];
      incorparationCertificate?: File[];
      bussinessLicense?: File[];
      coverImage?: File[];
      logo?: File[];
      variant_image?: File[];
      review_image?: File[];
      review_video?: File[];
      thumbnail?: File[];
      venue_logo?: File[];
    };
  }
}
