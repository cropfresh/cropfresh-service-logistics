import * as grpc from '@grpc/grpc-js';
import { LogisticsServiceHandlers } from '../../protos/cropfresh/logistics/LogisticsService';
import { Logger } from 'pino';

export const logisticsServiceHandlers = (logger: Logger): LogisticsServiceHandlers => ({
  CalculateRoute: (call, callback) => {
    logger.info('CalculateRoute called');
    callback(null, { distance: 10, duration: 20, waypoints: [] });
  },
  AssignHauler: (call, callback) => {
    logger.info('AssignHauler called');
    callback(null, { shipmentId: call.request.shipmentId, haulerId: 'hauler-1' });
  },
  UpdateShipmentStatus: (call, callback) => {
    logger.info('UpdateShipmentStatus called');
    callback(null, { shipmentId: call.request.shipmentId, status: call.request.status });
  },
  GetShipment: (call, callback) => {
    logger.info('GetShipment called');
    callback(null, { id: call.request.id, status: 'PENDING' });
  }
});
