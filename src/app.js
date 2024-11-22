const BLAST_CONTRACT_ADDRESS = '0x4300000000000000000000000000000000000002';
const BLAST_RPC_URL = 'https://rpc.blast.io';
const YIELD_MODES = ['Automatic', 'Void', 'Claimable'];
const GAS_MODES = ['Void', 'Claimable'];
const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

// Initialize web3 with direct RPC connection
const web3 = new Web3(new Web3.providers.HttpProvider(BLAST_RPC_URL));

async function getEthPrice() {
    try {
        const response = await fetch(ETH_PRICE_API);
        const data = await response.json();
        return data.ethereum.usd;
    } catch (error) {
        console.error('Error fetching ETH price:', error);
        return null;
    }
}

function formatEthAndUsd(ethAmount, ethPrice) {
    const ethValue = parseFloat(web3.utils.fromWei(ethAmount, 'ether'));
    const usdValue = ethPrice ? (ethValue * ethPrice).toFixed(2) : null;
    return usdValue 
        ? `${ethValue.toFixed(6)} ETH ($${usdValue} USD)`
        : `${ethValue.toFixed(6)} ETH`;
}

async function initContract() {
    const response = await fetch('./contracts/abi/Blast.json');
    const abi = await response.json();
    return new web3.eth.Contract(abi, BLAST_CONTRACT_ADDRESS);
}

async function checkContract() {
    const contractAddress = elem('#contractAddress').value;
    if (!web3.utils.isAddress(contractAddress)) {
        alert('Please enter a valid Ethereum address');
        return;
    }

    const contract = await initContract();
    const ethPrice = await getEthPrice();
    
    try {
        // Read Yield Configuration
        const yieldConfig = await contract.methods.readYieldConfiguration(contractAddress).call();
        elem('#yieldConfig').textContent = `Mode: ${YIELD_MODES[yieldConfig]}`;

        // Read Gas Parameters
        const gasParams = await contract.methods.readGasParams(contractAddress).call();
        const etherSeconds = gasParams[0];
        const etherBalance = gasParams[1];
        const lastUpdated = gasParams[2];
        const gasMode = gasParams[3];

        elem('#gasParamsBalance').textContent = 
            `Ether Balance: ${formatEthAndUsd(etherBalance, ethPrice)}`;
        elem('#gasParamsLastUpdate').textContent = 
            `Last Update: ${new Date(lastUpdated * 1000).toLocaleString()}`;
        
        const secondsPerMonth = web3.utils.toBN(30 * 24 * 60 * 60);
        const etherMonths = web3.utils.toBN(etherSeconds).div(secondsPerMonth);
        elem('#gasParamsGasMonths').textContent = 
            `Claimable Matured Gas: ${formatEthAndUsd(etherMonths, ethPrice)}`;
        elem('#gasParamsMode').textContent = `Gas Mode: ${GAS_MODES[gasMode]}`;

        // Read Claimable Yield
        const claimableYield = await contract.methods.readClaimableYield(contractAddress).call();
        elem('#claimableYield').textContent = 
            `Claimable yield: ${formatEthAndUsd(claimableYield, ethPrice)}`;

        // Show results section
        elem('.results-section').style.display = 'block';
    } catch (error) {
        console.error('Error fetching contract data:', error);
        alert('Error fetching contract data. Please check the console for details.');
    }
}

// Simple initialization
function init() {
    elem('#checkContract').addEventListener('click', checkContract);
}

window.addEventListener('load', init); 