import * as grpc from '@grpc/grpc-js';
import { LogisticsServiceHandlers } from '../../protos/cropfresh/logistics/LogisticsService';
import { Logger } from 'pino';

export const logisticsServiceHandlers = (logger: Logger): LogisticsServiceHandlers => ({
  AssignRoute: (call, callback) => {
    logger.info('AssignRoute called');
    callback(null, {
      routeId: 'route-1',
      waypoints: [],
      estimatedDistanceKm: 100,
      estimatedDurationHours: 2,
      earnings: 50
    });
  },
  GetOptimizedRoute: (call, callback) => {
    logger.info('GetOptimizedRoute called');
    callback(null, { optimizedWaypoints: [], totalDistanceKm: 100 });
  },
  UpdateLocation: (call, callback) => {
    logger.info('UpdateLocation called');
    callback(null, { success: true, nextWaypoint: 'waypoint-2' });
  },
  CompleteRoute: (call, callback) => {
    logger.info('CompleteRoute called');
    callback(null, { success: true, earnings: 50, paymentId: 'payment-1' });
  }
});
