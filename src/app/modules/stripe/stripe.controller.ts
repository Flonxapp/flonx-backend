import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import StripeService from './stripe.service';

const createOnboardingLink = catchAsync(async (req, res) => {
  const result = await StripeService.createConnectedAccountAndOnboardingLink(
    req.user,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Link created successfully',
    data: result,
  });
});
const updateOnboardingLink = catchAsync(async (req, res) => {
  const result = await StripeService.updateOnboardingLink(req.user);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Link updated successfully',
    data: result,
  });
});
const detachPaymentMethod = catchAsync(async (req, res) => {
  const result = await StripeService.detachPaymentMethod(
    req.body.paymentIntentId,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Payment method detached successfully',
    data: result,
  });
});
const StripeController = {
  createOnboardingLink,
  updateOnboardingLink,
  detachPaymentMethod,
};

export default StripeController;
