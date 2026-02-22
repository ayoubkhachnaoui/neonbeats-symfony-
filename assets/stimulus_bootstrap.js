import { Application } from '@hotwired/stimulus';
import FullPlayerController from './controllers/full_player_controller';
import VisualizerController from './controllers/visualizer_controller';

const app = Application.start();

// Register controllers manually
app.register('full-player', FullPlayerController);
app.register('visualizer', VisualizerController);

export { app };
