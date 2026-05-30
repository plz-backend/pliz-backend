import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { getAllLocationData } from '../controllers/get-all-location.controller';
import { getNigerianStates } from '../controllers/get-states.controller';
import { getLGAs } from '../controllers/get-lgas.controller';
import { getPassportOffices } from '../controllers/get-passport-offices.controller';

const router = Router();

// GET /api/location/all
// Everything in one call — mobile uses this on form load
router.get('/all', authenticate, getAllLocationData);

// GET /api/location/states
router.get('/states', authenticate, getNigerianStates);

// GET /api/location/lgas/:state  e.g. /lgas/Lagos
router.get('/lgas/:state', authenticate, getLGAs);

// GET /api/location/passport-offices
router.get('/passport-offices', authenticate, getPassportOffices);

export default router;