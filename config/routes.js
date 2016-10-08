// New routes can be defined in here, for example:

/*
// Create a new section (path)
var mysection = Router.section('mysection', '/my-section-path');

mysection.get('MyController#myAction', '/path_piece/:parameter');
*/

Router.linkup('Beacon::collect', 'beaconcollect', 'BeaconChimera#collectLink');
Router.linkup('Beacon::train', 'beacontrain', 'BeaconChimera#trainLink');