import * as udp from 'dgram';
import { Logging } from 'homebridge';

const LISTEN_ADDRESS = '0.0.0.0';
const LISTEN_PORT = 30000;
const PROBLE_PORT = 30050;
const MULTICAST_ADDRESS = '224.0.0.1';
const PROBE_ADDRESS = '255.255.255.255';
const PROBE_ATTEMPTS = 10;
const PROBE_INTERVAL = 500;
const PROBE_DATA = Buffer.from('DAIKIN_UDP/common/basic_info');

const discover = (log: Logging): Promise<Set<string>> => {
    return new Promise((resolve) => {
        log.info(
            `Starting auto-discovery of Daikin devices for ${
                (PROBE_ATTEMPTS * PROBE_INTERVAL) / 1000
            } seconds`
        );

        const discoveredDevices = new Set<string>();

        let probeTimeout: NodeJS.Timeout | null = null;

        const udpSocket = udp.createSocket({ type: 'udp4', reuseAddr: true });

        udpSocket.on('error', (err) => {
            log.debug('UDP Socket Error:', err);
        });

        udpSocket.bind(LISTEN_PORT, LISTEN_ADDRESS, () => {
            udpSocket.addMembership(MULTICAST_ADDRESS);
            udpSocket.setBroadcast(true);
        });

        udpSocket.on('message', (message, remote) => {
            log.debug(
                'UDP Socket message',
                `${remote.address}:${remote.port}`,
                message.toString()
            );

            discoveredDevices.add(remote.address);
        });

        udpSocket.on('listening', () => {
            sendProbes(PROBE_ATTEMPTS);
        });

        const sendProbes = (attemptsLeft: number): void => {
            probeTimeout = null;

            if (attemptsLeft > 0) {
                log.debug(
                    'Sending UDP discovery package attempt #',
                    attemptsLeft
                );
                udpSocket.send(
                    PROBE_DATA,
                    0,
                    PROBE_DATA.length,
                    PROBLE_PORT,
                    PROBE_ADDRESS
                );
                probeTimeout = setTimeout(
                    sendProbes,
                    PROBE_INTERVAL,
                    --attemptsLeft
                );
            } else {
                finalizeDiscovery();
            }
        };

        const finalizeDiscovery = (): void => {
            if (probeTimeout) {
                clearTimeout(probeTimeout);
            }
            udpSocket.close();
            log.info(
                `Auto-discovery finished with ${discoveredDevices.size} device(s) found`
            );
            resolve(discoveredDevices);
        };
    });
};

export default discover;
