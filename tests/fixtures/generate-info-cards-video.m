// Reproducible local H.264 sample using macOS AVFoundation; no downloaded media.
// clang -fobjc-arc -framework AVFoundation -framework CoreVideo -framework CoreMedia -framework Foundation \
//   tests/fixtures/generate-info-cards-video.m -o /tmp/info-video-generator
// /tmp/info-video-generator /tmp/info-cards-sample.mp4
#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>

int main(int argc, const char *argv[]) { @autoreleasepool {
  if (argc != 2) return 1;
  const int width = 192, height = 320, fps = 10;
  NSError *error = nil;
  AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:[NSURL fileURLWithPath:@(argv[1])] fileType:AVFileTypeMPEG4 error:&error];
  AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:@{
    AVVideoCodecKey: AVVideoCodecTypeH264, AVVideoWidthKey: @(width), AVVideoHeightKey: @(height)}];
  AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input sourcePixelBufferAttributes:@{
    (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
    (NSString *)kCVPixelBufferWidthKey: @(width), (NSString *)kCVPixelBufferHeightKey: @(height)}];
  [writer addInput:input];
  if (![writer startWriting]) { NSLog(@"%@", writer.error); return 1; }
  [writer startSessionAtSourceTime:kCMTimeZero];
  for (int frame = 0; frame < 200; frame++) {
    while (!input.readyForMoreMediaData) [NSThread sleepForTimeInterval:0.005];
    CVPixelBufferRef buffer = NULL;
    if (CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer) != kCVReturnSuccess) return 1;
    CVPixelBufferLockBaseAddress(buffer, 0);
    uint8_t *bytes = CVPixelBufferGetBaseAddress(buffer);
    size_t row = CVPixelBufferGetBytesPerRow(buffer);
    for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
      size_t offset = y * row + x * 4;
      BOOL marker = y > 80 && y < 240 && abs(x - (frame * 2 % width)) < 9;
      bytes[offset] = marker ? 200 : 85;
      bytes[offset + 1] = marker ? 220 : 60 + y / 8;
      bytes[offset + 2] = marker ? 235 : 40;
      bytes[offset + 3] = 255;
    }
    CVPixelBufferUnlockBaseAddress(buffer, 0);
    BOOL success = [adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake(frame, fps)];
    CVPixelBufferRelease(buffer);
    if (!success) return 1;
  }
  [input markAsFinished];
  dispatch_semaphore_t done = dispatch_semaphore_create(0);
  [writer finishWritingWithCompletionHandler:^{ dispatch_semaphore_signal(done); }];
  dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
  if (writer.status != AVAssetWriterStatusCompleted) { NSLog(@"%@", writer.error); return 1; }
  NSLog(@"Generated 20-second H.264 fixture: %s", argv[1]);
  return 0;
}}
