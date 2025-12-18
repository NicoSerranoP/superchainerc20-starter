import { createMerkleProof, createMPT } from '@ethereumjs/mpt'
import { utf8ToBytes } from '@ethereumjs/util'
import { encodeReceipt, TxReceipt } from '@ethereumjs/vm'
import { bytesToHex, Hex, TransactionReceipt, numberToBytes } from 'viem'

type BuildReceiptTrieArgs = {
  receipts: TransactionReceipt[]
  receiptsRootHash: Hex
  targetTxIndex: Hex
}

type BuildReceiptTrieReturn = {
  rootHash: Hex
  key: Hex
  proofNodes: Hex[]
}

export async function buildReceiptTrie({
  receipts,
  receiptsRootHash,
  targetTxIndex,
}: BuildReceiptTrieArgs): Promise<BuildReceiptTrieReturn> {
  const trie = await createMPT()

  for (const receipt of receipts) {
    const key = numberToBytes(receipt.transactionIndex)
    // TODO: Find the right way to encode the receipt
    const value = encodeReceipt(receipt as unknown as TxReceipt, receipt.type)

    await trie.put(key, value)
  }

  const trieRoot = bytesToHex(trie.root())

  if (trieRoot.toLowerCase() !== receiptsRootHash.toLowerCase()) {
    throw new Error(
      `Receipts root mismatch: expected ${receiptsRootHash}, got ${trieRoot}`,
    )
  }

  const targetKey = utf8ToBytes(targetTxIndex)
  const proof = await createMerkleProof(trie, targetKey)

  return {
    rootHash: receiptsRootHash,
    key: bytesToHex(targetKey),
    proofNodes: proof.map((node) => bytesToHex(node)),
  }
}
